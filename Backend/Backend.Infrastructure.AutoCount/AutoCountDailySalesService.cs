using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountDailySalesService.
    /// Converts POS daily sales submissions into AutoCount Cash Book Entry (OR).
    ///
    /// This matches AutoCount POS native posting behavior:
    /// "This is to post the entries to AutoCount Accounting cash transaction (Cash Book Entry).
    /// The posting is daily based, which means one entry on each date.
    /// All cash sales will be posted as a lump sum in each specific date."
    ///
    /// Document Types:
    /// - OR (Official Receipt / Cash Receipt) for sales received
    /// - Uses G/L accounts from Location Maintenance or system defaults
    /// </summary>
    public class AutoCountDailySalesService : IAutoCountDailySalesService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        // Simple in-memory cache for idempotency (POS reference -> AutoCount doc no)
        // In production, this could be backed by a database table for persistence.
        private static readonly Dictionary<string, string> _posReferenceCache = new Dictionary<string, string>();
        private static readonly object _cachelock = new object();

        // Default G/L accounts (can be configured)
        private const string DEFAULT_CASH_ACCOUNT = "100-0001";  // Cash on Hand
        private const string DEFAULT_SALES_ACCOUNT = "400-0000"; // Sales Revenue

        public AutoCountDailySalesService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        public DailySales SubmitDailySales(DailySales dailySales)
        {
            if (dailySales == null)
                throw new ArgumentNullException("dailySales");

            // Validate first
            var validation = ValidateDailySales(dailySales);
            if (!validation.IsValid)
            {
                dailySales.Status = "failed";
                dailySales.ErrorMessage = string.Join("; ", validation.Errors);
                return dailySales;
            }

            // Check for duplicate submission (idempotency)
            if (!string.IsNullOrWhiteSpace(dailySales.PosReference) && DailySalesExists(dailySales.PosReference))
            {
                var existing = GetDailySalesByPosReference(dailySales.PosReference);
                if (existing != null)
                {
                    existing.Status = "already_synced";
                    return existing;
                }
            }

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Calculate totals from line items
                    decimal subtotal = 0;
                    decimal taxTotal = 0;
                    foreach (var line in dailySales.Lines)
                    {
                        decimal lineAmt = line.LineAmount != 0 ? line.LineAmount : (line.Quantity * line.UnitPrice);
                        subtotal += lineAmt;
                        taxTotal += line.TaxAmount;
                    }
                    decimal grandTotal = subtotal + taxTotal;

                    // Build description with POS context
                    string description = BuildDescription(dailySales);

                    // Generate document number (OR-YYYYMMDD-STORECODE-SEQ)
                    string docNo = GenerateCashBookDocNo(dbSetting, dailySales);

                    // Determine G/L accounts
                    string cashAccount = !string.IsNullOrWhiteSpace(dailySales.CashBankGLAccount)
                        ? dailySales.CashBankGLAccount
                        : DEFAULT_CASH_ACCOUNT;
                    string salesAccount = !string.IsNullOrWhiteSpace(dailySales.SalesGLAccount)
                        ? dailySales.SalesGLAccount
                        : DEFAULT_SALES_ACCOUNT;

                    // Insert Cash Book Entry (OR - Official Receipt)
                    // BCE table structure: DocNo, DocDate, DocType, Description, Amount, etc.
                    InsertCashBookEntry(dbSetting, docNo, dailySales, grandTotal, description, cashAccount, salesAccount);

                    // Update result
                    dailySales.AutoCountDocNo = docNo;
                    dailySales.Subtotal = subtotal;
                    dailySales.TaxAmount = taxTotal;
                    dailySales.GrandTotal = grandTotal;
                    dailySales.Status = "synced";
                    dailySales.SyncedAt = DateTime.UtcNow;

                    // Cache for idempotency
                    if (!string.IsNullOrWhiteSpace(dailySales.PosReference))
                    {
                        lock (_cachelock)
                        {
                            _posReferenceCache[dailySales.PosReference] = docNo;
                        }
                    }

                    return dailySales;
                }
                catch (Exception ex)
                {
                    dailySales.Status = "failed";
                    dailySales.ErrorMessage = "Failed to sync to AutoCount: " + ex.Message;
                    throw new InvalidOperationException("Failed to submit daily sales to AutoCount.", ex);
                }
            }
        }

        /// <summary>
        /// Generates a unique document number for Cash Book Entry.
        /// Format: OR-YYYYMMDD-STORECODE-SEQ
        /// </summary>
        private string GenerateCashBookDocNo(global::AutoCount.Data.DBSetting dbSetting, DailySales dailySales)
        {
            string dateStr = dailySales.SalesDate.ToString("yyyyMMdd");
            string storeCode = dailySales.StoreCode.Replace("-", "").Substring(0, Math.Min(8, dailySales.StoreCode.Length));

            // Get next sequence for this date/store combination
            string prefix = string.Format("OR-{0}-{1}-", dateStr, storeCode);
            string sql = string.Format(
                "SELECT COUNT(*) + 1 FROM BCE WHERE DocNo LIKE '{0}%'",
                prefix.Replace("'", "''"));

            DataTable dt = dbSetting.GetDataTable(sql, false);
            int seq = dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0][0]) : 1;

            return string.Format("{0}{1:D3}", prefix, seq);
        }

        /// <summary>
        /// Inserts a Cash Book Entry (OR) record into AutoCount.
        /// Creates a double-entry: Debit Cash/Bank, Credit Sales Revenue.
        /// </summary>
        private void InsertCashBookEntry(
            global::AutoCount.Data.DBSetting dbSetting,
            string docNo,
            DailySales dailySales,
            decimal amount,
            string description,
            string cashAccount,
            string salesAccount)
        {
            // Get next DocKey
            string getKeySQL = "SELECT ISNULL(MAX(DocKey), 0) + 1 FROM BCE";
            DataTable keyDt = dbSetting.GetDataTable(getKeySQL, false);
            long docKey = keyDt.Rows.Count > 0 ? Convert.ToInt64(keyDt.Rows[0][0]) : 1;

            // Insert BCE header
            string insertHeaderSQL = string.Format(@"
                INSERT INTO BCE (
                    DocKey, DocNo, DocDate, DocType, Description,
                    CurrencyCode, CurrencyRate, Amount,
                    Cancelled, IsPosted, CreatedTimeStamp, CreatedUserID
                ) VALUES (
                    {0}, '{1}', '{2}', 'OR', '{3}',
                    '{4}', 1.0, {5},
                    0, 1, GETDATE(), 'POS'
                )",
                docKey,
                docNo.Replace("'", "''"),
                dailySales.SalesDate.ToString("yyyy-MM-dd"),
                description.Replace("'", "''"),
                string.IsNullOrWhiteSpace(dailySales.CurrencyCode) ? "PHP" : dailySales.CurrencyCode,
                amount);

            dbSetting.ExecuteNonQuery(insertHeaderSQL, false);

            // Insert BCE detail lines (double-entry)
            // Line 1: Debit Cash/Bank Account
            string insertDebitSQL = string.Format(@"
                INSERT INTO BCEDtl (
                    DocKey, DtlKey, AccNo, Description,
                    Debit, Credit, TaxType, TaxCode
                ) VALUES (
                    {0}, 1, '{1}', '{2}',
                    {3}, 0, '', ''
                )",
                docKey,
                cashAccount.Replace("'", "''"),
                ("POS Sales - " + dailySales.StoreCode).Replace("'", "''"),
                amount);

            dbSetting.ExecuteNonQuery(insertDebitSQL, false);

            // Line 2: Credit Sales Revenue Account
            string insertCreditSQL = string.Format(@"
                INSERT INTO BCEDtl (
                    DocKey, DtlKey, AccNo, Description,
                    Debit, Credit, TaxType, TaxCode
                ) VALUES (
                    {0}, 2, '{1}', '{2}',
                    0, {3}, '', ''
                )",
                docKey,
                salesAccount.Replace("'", "''"),
                ("POS Sales - " + dailySales.StoreCode).Replace("'", "''"),
                amount);

            dbSetting.ExecuteNonQuery(insertCreditSQL, false);
        }

        public DailySales GetDailySalesByPosReference(string posReference)
        {
            if (string.IsNullOrWhiteSpace(posReference))
                return null;

            string docNo;
            lock (_cachelock)
            {
                if (!_posReferenceCache.TryGetValue(posReference, out docNo))
                    return null;
            }

            return GetDailySalesByDocNo(docNo);
        }

        public DailySales GetDailySalesByDocNo(string autoCountDocNo)
        {
            if (string.IsNullOrWhiteSpace(autoCountDocNo))
                return null;

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query BCE table for Cash Book Entry
                    string sql = string.Format(@"
                        SELECT DocNo, DocDate, DocType, Description, Amount, CurrencyCode, Cancelled
                        FROM BCE
                        WHERE DocNo = '{0}'",
                        autoCountDocNo.Replace("'", "''"));

                    DataTable dt = dbSetting.GetDataTable(sql, false);
                    if (dt.Rows.Count == 0)
                        return null;

                    return MapBCEToDailySales(dt.Rows[0]);
                }
                catch
                {
                    return null;
                }
            }
        }

        public bool DailySalesExists(string posReference)
        {
            if (string.IsNullOrWhiteSpace(posReference))
                return false;

            lock (_cachelock)
            {
                return _posReferenceCache.ContainsKey(posReference);
            }
        }

        public List<DailySales> GetDailySalesList(DateTime? startDate, DateTime? endDate, string storeCode, int? limit)
        {
            var results = new List<DailySales>();
            int maxRecords = limit ?? 100;

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Build WHERE clause for BCE (Cash Book Entry) table
                    // Filter by OR (Official Receipt) documents from POS
                    var conditions = new List<string>();
                    conditions.Add("DocType = 'OR'");
                    conditions.Add("DocNo LIKE 'OR-%'"); // POS-generated docs start with OR-

                    if (startDate.HasValue)
                        conditions.Add(string.Format("DocDate >= '{0:yyyy-MM-dd}'", startDate.Value));

                    if (endDate.HasValue)
                        conditions.Add(string.Format("DocDate <= '{0:yyyy-MM-dd}'", endDate.Value));

                    if (!string.IsNullOrWhiteSpace(storeCode))
                    {
                        // Store code is embedded in description or DocNo
                        conditions.Add(string.Format("(Description LIKE '%{0}%' OR DocNo LIKE '%{0}%')",
                            storeCode.Replace("'", "''").Replace("-", "").Substring(0, Math.Min(8, storeCode.Replace("-", "").Length))));
                    }

                    string whereClause = string.Join(" AND ", conditions);

                    string sql = string.Format(@"
                        SELECT TOP {0} DocNo, DocDate, DocType, Description, Amount, CurrencyCode, Cancelled
                        FROM BCE
                        WHERE {1}
                        ORDER BY DocDate DESC, DocNo DESC",
                        maxRecords,
                        whereClause);

                    DataTable dt = dbSetting.GetDataTable(sql, false);

                    foreach (DataRow row in dt.Rows)
                    {
                        var dailySales = MapBCEToDailySales(row);
                        if (dailySales != null)
                        {
                            // Extract store code from description if possible
                            string desc = GetString(row, "Description") ?? "";
                            if (desc.Contains("POS Sales - "))
                            {
                                int idx = desc.IndexOf("POS Sales - ") + 12;
                                int endIdx = desc.IndexOf(" |", idx);
                                if (endIdx < 0) endIdx = desc.Length;
                                dailySales.StoreCode = desc.Substring(idx, endIdx - idx).Trim();
                            }
                            results.Add(dailySales);
                        }
                    }
                }
                catch (Exception)
                {
                    // Return empty list on error
                }
            }

            return results;
        }

        public DailySalesValidationResult ValidateDailySales(DailySales dailySales)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            if (dailySales == null)
            {
                return new DailySalesValidationResult
                {
                    IsValid = false,
                    Errors = new[] { "Daily sales data is required" },
                    Warnings = new string[0]
                };
            }

            // Required fields
            if (string.IsNullOrWhiteSpace(dailySales.StoreCode))
                errors.Add("StoreCode is required");

            if (dailySales.SalesDate == DateTime.MinValue)
                errors.Add("SalesDate is required");

            if (dailySales.SalesDate > DateTime.Today.AddDays(1))
                errors.Add("SalesDate cannot be in the future");

            if (dailySales.Lines == null || dailySales.Lines.Count == 0)
                errors.Add("At least one line item is required");

            // Validate lines
            if (dailySales.Lines != null)
            {
                for (int i = 0; i < dailySales.Lines.Count; i++)
                {
                    var line = dailySales.Lines[i];
                    if (string.IsNullOrWhiteSpace(line.ItemCode))
                        errors.Add(string.Format("Line {0}: ItemCode is required", i + 1));
                    if (line.Quantity <= 0)
                        errors.Add(string.Format("Line {0}: Quantity must be greater than 0", i + 1));
                    if (line.UnitPrice < 0)
                        errors.Add(string.Format("Line {0}: UnitPrice cannot be negative", i + 1));
                }
            }

            // Warnings (non-blocking)
            if (string.IsNullOrWhiteSpace(dailySales.PosReference))
                warnings.Add("PosReference is recommended for idempotency");

            if (string.IsNullOrWhiteSpace(dailySales.CashRegisterId))
                warnings.Add("CashRegisterId is recommended for audit purposes");

            if (dailySales.Payments == null || dailySales.Payments.Count == 0)
                warnings.Add("Payment breakdown is recommended for reconciliation");

            return new DailySalesValidationResult
            {
                IsValid = errors.Count == 0,
                Errors = errors.ToArray(),
                Warnings = warnings.ToArray()
            };
        }

        private string BuildDescription(DailySales dailySales)
        {
            var parts = new List<string>();
            parts.Add("POS Daily Sales");

            if (!string.IsNullOrWhiteSpace(dailySales.CashRegisterId))
                parts.Add("Register: " + dailySales.CashRegisterId);

            if (!string.IsNullOrWhiteSpace(dailySales.Shift))
                parts.Add("Shift: " + dailySales.Shift);

            if (!string.IsNullOrWhiteSpace(dailySales.PosReference))
                parts.Add("Ref: " + dailySales.PosReference);

            if (!string.IsNullOrWhiteSpace(dailySales.OperatorName))
                parts.Add("Operator: " + dailySales.OperatorName);

            if (!string.IsNullOrWhiteSpace(dailySales.Remarks))
                parts.Add(dailySales.Remarks);

            return string.Join(" | ", parts);
        }

        /// <summary>
        /// Maps a BCE (Cash Book Entry) DataRow to DailySales domain object.
        /// </summary>
        private DailySales MapBCEToDailySales(DataRow row)
        {
            if (row == null)
                return null;

            return new DailySales
            {
                DocumentType = GetString(row, "DocType"),
                AutoCountDocNo = GetString(row, "DocNo"),
                SalesDate = row["DocDate"] != DBNull.Value ? Convert.ToDateTime(row["DocDate"]) : DateTime.MinValue,
                GrandTotal = row["Amount"] != DBNull.Value ? Convert.ToDecimal(row["Amount"]) : 0,
                CurrencyCode = GetString(row, "CurrencyCode"),
                Status = row["Cancelled"] != DBNull.Value && Convert.ToBoolean(row["Cancelled"]) ? "cancelled" : "synced",
                Remarks = GetString(row, "Description"),
                Lines = new List<DailySalesLine>()
            };
        }

        /// <summary>
        /// Safely gets a string value from a DataRow.
        /// </summary>
        private string GetString(DataRow row, string columnName)
        {
            if (row == null || !row.Table.Columns.Contains(columnName))
                return null;
            return row[columnName] != DBNull.Value ? row[columnName].ToString() : null;
        }
    }
}
