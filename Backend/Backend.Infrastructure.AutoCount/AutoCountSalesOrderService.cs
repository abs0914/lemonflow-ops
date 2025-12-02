using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using AutoCount;
using AutoCount.Invoicing.Sales.SalesOrder;
using Backend.Domain;
using DomainSalesOrder = Backend.Domain.SalesOrder;
using DomainSalesOrderLine = Backend.Domain.SalesOrderLine;
using AutoCountSalesOrderDocument = AutoCount.Invoicing.Sales.SalesOrder.SalesOrder;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountSalesOrderService using
    /// AutoCount 2.x Sales Order API.
    ///
    /// References:
    /// https://wiki.autocountsoft.com/wiki/Programmer:Sales_Order_v2
    /// </summary>
    public class AutoCountSalesOrderService : IAutoCountSalesOrderService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountSalesOrderService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        /// <inheritdoc />
        public List<DomainSalesOrder> GetSalesOrders(int? limit = null)
        {
            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query SO table for document headers
                    string sql = @"
                        SELECT TOP {0}
                            s.DocNo, s.DocDate, s.DebtorCode, s.Description, 
                            s.Cancelled, s.CurrencyCode, s.CurrencyRate,
                            s.NetTotal
                        FROM SO s
                        ORDER BY s.DocDate DESC, s.DocNo DESC";

                    int maxRows = limit.HasValue && limit.Value > 0 ? limit.Value : 100;
                    sql = string.Format(sql, maxRows);

                    DataTable tbl = dbSetting.GetDataTable(sql, false);

                    var result = new List<DomainSalesOrder>();
                    foreach (DataRow row in tbl.Rows)
                    {
                        var so = new DomainSalesOrder
                        {
                            DocNo = GetString(row, "DocNo"),
                            DebtorCode = GetString(row, "DebtorCode"),
                            DocDate = GetDateTime(row, "DocDate") ?? DateTime.Today,
                            Description = GetString(row, "Description"),
                            IsCancelled = GetBool(row, "Cancelled", false),
                            CurrencyCode = GetString(row, "CurrencyCode"),
                            CurrencyRate = GetDecimal(row, "CurrencyRate") ?? 1,
                            TotalAmount = GetDecimal(row, "NetTotal") ?? 0
                        };
                        result.Add(so);
                    }

                    return result;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve sales orders from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public DomainSalesOrder GetSalesOrderByDocNo(string docNo)
        {
            if (string.IsNullOrWhiteSpace(docNo))
                throw new ArgumentException("Document number is required.", "docNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query SO header
                    string headerSql = @"
                        SELECT s.DocNo, s.DocDate, s.DebtorCode, s.Description, 
                               s.Cancelled, s.CurrencyCode, s.CurrencyRate, s.NetTotal, s.Agent
                        FROM SO s
                        WHERE s.DocNo = @DocNo";

                    var param = new System.Data.SqlClient.SqlParameter("@DocNo", docNo);
                    DataTable headerTbl = dbSetting.GetDataTable(headerSql, false, new[] { param });

                    if (headerTbl.Rows.Count == 0)
                        return null;

                    var headerRow = headerTbl.Rows[0];
                    var so = new DomainSalesOrder
                    {
                        DocNo = GetString(headerRow, "DocNo"),
                        DebtorCode = GetString(headerRow, "DebtorCode"),
                        DocDate = GetDateTime(headerRow, "DocDate") ?? DateTime.Today,
                        Description = GetString(headerRow, "Description"),
                        IsCancelled = GetBool(headerRow, "Cancelled", false),
                        CurrencyCode = GetString(headerRow, "CurrencyCode"),
                        CurrencyRate = GetDecimal(headerRow, "CurrencyRate") ?? 1,
                        TotalAmount = GetDecimal(headerRow, "NetTotal") ?? 0,
                        SalesPerson = GetString(headerRow, "Agent"),
                        Lines = new List<DomainSalesOrderLine>()
                    };

                    // Query SO details
                    string detailSql = @"
                        SELECT d.Seq, d.ItemCode, d.Description, d.Qty, d.UnitPrice, 
                               d.UOM, d.SubTotal, d.TaxType, d.Location, d.Discount
                        FROM SODtl d
                        WHERE d.DocNo = @DocNo
                        ORDER BY d.Seq";

                    var detailParam = new System.Data.SqlClient.SqlParameter("@DocNo", docNo);
                    DataTable detailTbl = dbSetting.GetDataTable(detailSql, false, new[] { detailParam });

                    int lineNumber = 0;
                    foreach (DataRow detailRow in detailTbl.Rows)
                    {
                        lineNumber++;
                        var detail = new DomainSalesOrderLine
                        {
                            LineNumber = lineNumber,
                            ItemCode = GetString(detailRow, "ItemCode"),
                            Description = GetString(detailRow, "Description"),
                            Quantity = GetDecimal(detailRow, "Qty") ?? 0,
                            UnitPrice = GetDecimal(detailRow, "UnitPrice") ?? 0,
                            UOM = GetString(detailRow, "UOM"),
                            SubTotal = GetDecimal(detailRow, "SubTotal") ?? 0,
                            TaxCode = GetString(detailRow, "TaxType"),
                            Location = GetString(detailRow, "Location"),
                            Discount = GetString(detailRow, "Discount")
                        };
                        so.Lines.Add(detail);
                    }

                    return so;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve sales order '" + docNo + "' from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public DomainSalesOrder CreateSalesOrder(DomainSalesOrder salesOrder)
        {
            if (salesOrder == null)
                throw new ArgumentNullException("salesOrder");

            if (string.IsNullOrWhiteSpace(salesOrder.DebtorCode))
                throw new ArgumentException("DebtorCode is required.", "salesOrder");

            if (salesOrder.Lines == null || !salesOrder.Lines.Any())
                throw new ArgumentException("Sales order must contain at least one line item.", "salesOrder");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    if (userSession == null)
                        throw new InvalidOperationException("Failed to get AutoCount user session.");

                    SalesOrderCommand cmd = SalesOrderCommand.Create(userSession, userSession.DBSetting);
                    if (cmd == null)
                        throw new InvalidOperationException("Failed to create SalesOrderCommand.");

                    AutoCountSalesOrderDocument doc = cmd.AddNew();
                    if (doc == null)
                        throw new InvalidOperationException("Failed to create new sales order document.");

                    // Header fields
                    doc.DebtorCode = salesOrder.DebtorCode;
                    doc.DocNo = string.IsNullOrWhiteSpace(salesOrder.DocNo)
                        ? Const.AppConst.NewDocumentNo
                        : salesOrder.DocNo;
                    doc.DocDate = salesOrder.DocDate == default(DateTime)
                        ? DateTime.Today.Date
                        : salesOrder.DocDate.Date;

                    if (!string.IsNullOrWhiteSpace(salesOrder.Description))
                        doc.Description = salesOrder.Description;

                    if (!string.IsNullOrWhiteSpace(salesOrder.SalesPerson))
                        doc.Agent = salesOrder.SalesPerson;

                    if (salesOrder.CurrencyRate > 0)
                        doc.CurrencyRate = salesOrder.CurrencyRate;

                    doc.InclusiveTax = salesOrder.InclusiveTax;

                    // Detail lines
                    foreach (var line in salesOrder.Lines)
                    {
                        SalesOrderDetail dtl = doc.AddDetail();
                        if (dtl == null)
                            throw new InvalidOperationException("Failed to add detail line.");

                        if (!string.IsNullOrWhiteSpace(line.ItemCode))
                            dtl.ItemCode = line.ItemCode;

                        if (!string.IsNullOrWhiteSpace(line.Description))
                            dtl.Description = line.Description;

                        if (!string.IsNullOrWhiteSpace(line.Location))
                            dtl.Location = line.Location;

                        dtl.Qty = line.Quantity;
                        dtl.UOM = string.IsNullOrWhiteSpace(line.UOM) ? "UNIT" : line.UOM;
                        dtl.UnitPrice = line.UnitPrice;

                        if (!string.IsNullOrWhiteSpace(line.Discount))
                            dtl.Discount = line.Discount;

                        if (!string.IsNullOrWhiteSpace(line.TaxCode))
                            dtl.TaxType = line.TaxCode;
                    }

                    doc.Save();

                    // Return with assigned document number
                    salesOrder.DocNo = doc.DocNo;
                    return salesOrder;
                }
                catch (AppException ex)
                {
                    throw new InvalidOperationException("AutoCount rejected sales order: " + ex.Message, ex);
                }
                catch (InvalidOperationException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create sales order in AutoCount: " + ex.Message, ex);
                }
            }
        }

        /// <inheritdoc />
        public bool CancelSalesOrder(string docNo)
        {
            if (string.IsNullOrWhiteSpace(docNo))
                throw new ArgumentException("Document number is required.", "docNo");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var cmd = SalesOrderCommand.Create(userSession, userSession.DBSetting);

                    return cmd.CancelDocument(docNo, userSession.LoginUserID);
                }
                catch (AppException ex)
                {
                    throw new InvalidOperationException("AutoCount failed to cancel sales order '" + docNo + "': " + ex.Message, ex);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to cancel sales order '" + docNo + "' in AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public bool SalesOrderExists(string docNo)
        {
            if (string.IsNullOrWhiteSpace(docNo))
                return false;

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var cmd = SalesOrderCommand.Create(userSession, userSession.DBSetting);

                    long docKey = cmd.GetDocKeyByDocNo(docNo);
                    return docKey > 0;
                }
                catch
                {
                    return false;
                }
            }
        }

        #region Helper Methods

        private static string GetString(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return row[columnName] as string;
        }

        private static DateTime? GetDateTime(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return Convert.ToDateTime(row[columnName]);
        }

        private static decimal? GetDecimal(DataRow row, string columnName)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return null;

            return Convert.ToDecimal(row[columnName]);
        }

        private static bool GetBool(DataRow row, string columnName, bool defaultValue)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return defaultValue;

            var value = row[columnName];

            if (value is string strVal)
            {
                return strVal.Equals("T", StringComparison.OrdinalIgnoreCase) ||
                       strVal.Equals("True", StringComparison.OrdinalIgnoreCase) ||
                       strVal.Equals("1", StringComparison.Ordinal);
            }

            return Convert.ToBoolean(value);
        }

        #endregion
    }
}

