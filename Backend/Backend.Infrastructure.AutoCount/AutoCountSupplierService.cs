using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using Backend.Domain;
using AutoCount.ARAP.Creditor;
using AutoCount.SearchFilter;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountSupplierService using AutoCount 2.1 API.
    ///
    /// This mirrors AutoCountDebtorService but operates on AP Creditors (suppliers).
    /// Access to AutoCount is serialized via a lock to avoid threading issues.
    /// </summary>
    public class AutoCountSupplierService : IAutoCountSupplierService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountSupplierService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        /// <inheritdoc />
        public List<Supplier> GetAllSuppliers()
        {
            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var suppliers = new List<Supplier>();

                    // Use CreditorDataAccess to load creditor data in bulk.
                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);
                    var criteria = new SearchCriteria();

                    // Load only the columns we need for the domain model.
                    string[] columns =
                    {
                        "AccNo",
                        "CompanyName",
                        "Address1",
                        "Address2",
                        "Attention",
                        "Phone1",
                        "EmailAddress",
                        "IsActive"
                    };

                    DataTable table = cmd.LoadCreditorData(columns, criteria);
                    foreach (DataRow row in table.Rows)
                    {
                        var supplier = MapDataRowToSupplier(row);
                        if (supplier != null)
                        {
                            suppliers.Add(supplier);
                        }
                    }

                    return suppliers;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve suppliers from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public Supplier GetSupplierByCode(string supplierCode)
        {
            if (string.IsNullOrWhiteSpace(supplierCode))
                throw new ArgumentException("Supplier code cannot be empty.", "supplierCode");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);
                    var acCreditor = cmd.GetCreditor(supplierCode);
                    if (acCreditor == null)
                        return null;

                    return MapAutoCountCreditorToDomain(acCreditor);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException(
                        "Failed to retrieve supplier '" + supplierCode + "' from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public bool SupplierExists(string supplierCode)
        {
            if (string.IsNullOrWhiteSpace(supplierCode))
                throw new ArgumentException("Supplier code cannot be empty.", "supplierCode");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);
                    var acCreditor = cmd.GetCreditor(supplierCode);
                    return acCreditor != null;
                }
                catch
                {
                    // On any unexpected error, treat as not existing. Callers can inspect
                    // detailed errors via GetSupplierByCode if needed.
                    return false;
                }
            }
        }

        private Supplier MapAutoCountCreditorToDomain(CreditorEntity acCreditor)
        {
            if (acCreditor == null)
                return null;

            var supplier = new Supplier
            {
                Code = acCreditor.AccNo,
                CompanyName = acCreditor.CompanyName,
                ContactPerson = acCreditor.Attention,
                Phone = acCreditor.Phone1,
                Email = acCreditor.EmailAddress,
                Address = CombineAddress(acCreditor.Address1, acCreditor.Address2),
                // Credit terms are not currently surfaced from AutoCount; default to 0/null.
                CreditTerms = 0,
                IsActive = acCreditor.IsActive
            };

            return supplier;
        }

        private Supplier MapDataRowToSupplier(DataRow row)
        {
            if (row == null)
                return null;
	   	 
	   	 	    var supplier = new Supplier
	   	 	    {
	   	 	        Code = GetString(row, "AccNo"),
	   	 	        CompanyName = GetString(row, "CompanyName"),
	   	 	        ContactPerson = GetString(row, "Attention"),
	   	 	        Phone = GetString(row, "Phone1"),
	   	 	        Email = GetString(row, "EmailAddress"),
	   	 	        Address = CombineAddress(GetString(row, "Address1"), GetString(row, "Address2")),
	   	 	        // As with entity mapping, credit terms are not currently populated.
	   	 	        CreditTerms = 0,
	   	 	        IsActive = GetBool(row, "IsActive", true)
	   	 	    };
	   	 
	   	 	    return supplier;
	   	 	}

	   	 	private static string GetString(DataRow row, string columnName)
	   	 	{
	   	 	    if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
	   	 	        return null;
	   	 
	   	 	    return (string)row[columnName];
	   	 	}
	   	 
        private static bool GetBool(DataRow row, string columnName, bool defaultValue)
        {
            if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                return defaultValue;

            var value = row[columnName];
            if (value is bool)
                return (bool)value;

            var s = value.ToString().Trim().ToUpperInvariant();
            if (s == "T" || s == "Y" || s == "1" || s == "TRUE" || s == "YES")
                return true;
            if (s == "F" || s == "N" || s == "0" || s == "FALSE" || s == "NO")
                return false;

            return defaultValue;
        }
	   	 
        private string CombineAddress(string address1, string address2)
        {
            if (string.IsNullOrWhiteSpace(address1) && string.IsNullOrWhiteSpace(address2))
                return null;

            if (string.IsNullOrWhiteSpace(address1))
                return address2;

            if (string.IsNullOrWhiteSpace(address2))
                return address1;

            return address1.Trim() + ", " + address2.Trim();
        }

        /// <inheritdoc />
        public Supplier CreateSupplier(Supplier supplier)
        {
            if (supplier == null)
                throw new ArgumentNullException("supplier");
            if (string.IsNullOrWhiteSpace(supplier.Code))
                throw new ArgumentException("Supplier code is required.", "supplier");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);

                    // Check if supplier already exists
                    CreditorEntity existing = null;
                    try
                    {
                        existing = cmd.GetCreditor(supplier.Code);
                    }
                    catch (CreditorRecordNotFoundException)
                    {
                        // Expected when creating a new supplier - the record shouldn't exist yet
                        existing = null;
                    }

                    if (existing != null)
                    {
                        throw new InvalidOperationException("Supplier '" + supplier.Code + "' already exists in AutoCount.");
                    }

                    // Insert creditor using raw SQL to handle GLMast FK constraint
                    // The AutoCount SDK's SaveCreditor() fails because GLMast record doesn't exist
                    InsertCreditorWithAllRequiredFields(dbSetting, supplier, userSession.LoginUserID);

                    // Reload the creditor using AutoCount API to return the proper entity
                    var reloaded = cmd.GetCreditor(supplier.Code);
                    return MapAutoCountCreditorToDomain(reloaded);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create supplier in AutoCount.", ex);
                }
            }
        }

        /// <summary>
        /// Inserts a new Creditor (Supplier) record using raw SQL with transaction.
        /// This is needed because AutoCount requires GLMast record to exist before Creditor can be created.
        /// AccType 'CL' = Current Liability (Trade Creditors/Suppliers)
        /// </summary>
        private void InsertCreditorWithAllRequiredFields(global::AutoCount.Data.DBSetting dbSetting, Supplier supplier, string userId)
        {
            string connStr = dbSetting.ConnectionString;
            string currencyCode = "PHP";

            using (var conn = new SqlConnection(connStr))
            {
                conn.Open();

                // Use a transaction to ensure both inserts succeed or fail together
                using (var transaction = conn.BeginTransaction())
                {
                    try
                    {
                        // Step 1: Insert GL account in GLMast (required by FK constraint)
                        // AccType 'CL' = Current Liability (Trade Creditors)
                        string insertGLSql = @"
                            INSERT INTO GLMast (AccNo, Description, AccType, CurrencyCode, [Guid])
                            VALUES (@AccNo, @Description, @AccType, @CurrencyCode, @Guid)";

                        using (var cmd = new SqlCommand(insertGLSql, conn, transaction))
                        {
                            cmd.Parameters.AddWithValue("@AccNo", supplier.Code ?? string.Empty);
                            cmd.Parameters.AddWithValue("@Description", supplier.CompanyName ?? supplier.Code ?? string.Empty);
                            cmd.Parameters.AddWithValue("@AccType", "CL");  // Current Liability - Trade Creditors
                            cmd.Parameters.AddWithValue("@CurrencyCode", currencyCode);
                            cmd.Parameters.AddWithValue("@Guid", Guid.NewGuid());
                            cmd.ExecuteNonQuery();
                        }

                        // Step 2: Insert Creditor record
                        string insertCreditorSql = @"
                            INSERT INTO Creditor (
                                AccNo, CompanyName, Address1, Address2, Attention, Phone1, EmailAddress,
                                DisplayTerm, CurrencyCode, AllowExceedCreditLimit, DiscountPercent,
                                IsActive, LastUpdate, InclusiveTax, RoundingMethod, [Guid],
                                CreatedUserID, CreatedTimeStamp, LastModifiedUserID, LastModified
                            ) VALUES (
                                @AccNo, @CompanyName, @Address1, @Address2, @Attention, @Phone1, @EmailAddress,
                                @DisplayTerm, @CurrencyCode, @AllowExceedCreditLimit, @DiscountPercent,
                                @IsActive, @LastUpdate, @InclusiveTax, @RoundingMethod, @Guid,
                                @CreatedUserID, @CreatedTimeStamp, @LastModifiedUserID, @LastModified
                            )";

                        using (var cmd = new SqlCommand(insertCreditorSql, conn, transaction))
                        {
                            // Parse address into Address1 and Address2
                            string address1 = supplier.Address ?? "";
                            string address2 = "";
                            if (!string.IsNullOrEmpty(supplier.Address) && supplier.Address.Contains(","))
                            {
                                var parts = supplier.Address.Split(new[] { ',' }, 2);
                                address1 = parts[0].Trim();
                                address2 = parts.Length > 1 ? parts[1].Trim() : "";
                            }

                            // Required fields
                            cmd.Parameters.AddWithValue("@AccNo", supplier.Code ?? string.Empty);
                            cmd.Parameters.AddWithValue("@CompanyName", (object)supplier.CompanyName ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@Address1", (object)address1 ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@Address2", (object)address2 ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@Attention", (object)supplier.ContactPerson ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@Phone1", (object)supplier.Phone ?? DBNull.Value);
                            cmd.Parameters.AddWithValue("@EmailAddress", (object)supplier.Email ?? DBNull.Value);

                            // NOT NULL columns with default values
                            cmd.Parameters.AddWithValue("@DisplayTerm", "C.O.D.");
                            cmd.Parameters.AddWithValue("@CurrencyCode", currencyCode);
                            cmd.Parameters.AddWithValue("@AllowExceedCreditLimit", "F");
                            cmd.Parameters.AddWithValue("@DiscountPercent", 0m);
                            cmd.Parameters.AddWithValue("@IsActive", supplier.IsActive ? "T" : "F");
                            cmd.Parameters.AddWithValue("@LastUpdate", 0);
                            cmd.Parameters.AddWithValue("@InclusiveTax", "F");
                            cmd.Parameters.AddWithValue("@RoundingMethod", 0);
                            cmd.Parameters.AddWithValue("@Guid", Guid.NewGuid());

                            // Audit fields
                            DateTime now = DateTime.Now;
                            string user = userId ?? "SYSTEM";
                            cmd.Parameters.AddWithValue("@CreatedUserID", user);
                            cmd.Parameters.AddWithValue("@CreatedTimeStamp", now);
                            cmd.Parameters.AddWithValue("@LastModifiedUserID", user);
                            cmd.Parameters.AddWithValue("@LastModified", now);

                            cmd.ExecuteNonQuery();
                        }

                        transaction.Commit();
                    }
                    catch
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
        }

        /// <inheritdoc />
        public Supplier UpdateSupplier(Supplier supplier)
        {
            if (supplier == null)
                throw new ArgumentNullException("supplier");
            if (string.IsNullOrWhiteSpace(supplier.Code))
                throw new ArgumentException("Supplier code is required.", "supplier");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);
                    var acCreditor = cmd.GetCreditor(supplier.Code);

                    if (acCreditor == null)
                    {
                        throw new InvalidOperationException("Supplier '" + supplier.Code + "' not found in AutoCount.");
                    }

                    MapDomainToCreditorEntity(supplier, acCreditor, userSession);
                    cmd.SaveCreditor(acCreditor, userSession.LoginUserID);

                    // Reload to confirm changes
                    var reloaded = cmd.GetCreditor(supplier.Code);
                    return MapAutoCountCreditorToDomain(reloaded);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to update supplier in AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public bool DeleteSupplier(string supplierCode)
        {
            if (string.IsNullOrWhiteSpace(supplierCode))
                throw new ArgumentException("Supplier code cannot be empty.", "supplierCode");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = CreditorDataAccess.Create(userSession, dbSetting);
                    var acCreditor = cmd.GetCreditor(supplierCode);

                    if (acCreditor == null)
                        return false;

                    // Soft delete by setting IsActive = false
                    acCreditor.IsActive = false;
                    cmd.SaveCreditor(acCreditor, userSession.LoginUserID);

                    return true;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException(
                        "Failed to delete supplier '" + supplierCode + "' from AutoCount.", ex);
                }
            }
        }

        private void MapDomainToCreditorEntity(Supplier supplier, CreditorEntity entity, global::AutoCount.Authentication.UserSession userSession)
        {
            // ControlAccount is REQUIRED - links creditor to GL control account (Trade Creditors)
            // This sets the ParentAccNo in GLMast with SpecialAccType = 'SCR'
            entity.ControlAccount = "400-0000";

            entity.AccNo = supplier.Code;
            entity.CompanyName = supplier.CompanyName ?? "";
            entity.Attention = supplier.ContactPerson ?? "";
            entity.Phone1 = supplier.Phone ?? "";
            entity.EmailAddress = supplier.Email ?? "";

            // Split address if needed (simple approach: put everything in Address1)
            if (!string.IsNullOrWhiteSpace(supplier.Address))
            {
                entity.Address1 = supplier.Address;
            }

            entity.IsActive = supplier.IsActive;

            // Set currency to PHP (hardcoded for LemonCo production)
            entity.CurrencyCode = "PHP";

            // Log what we're setting for debugging
            System.Diagnostics.Debug.WriteLine($"[MapDomainToCreditorEntity] AccNo={entity.AccNo}, CurrencyCode={entity.CurrencyCode}, ControlAccount={entity.ControlAccount}");
        }
    }
}


