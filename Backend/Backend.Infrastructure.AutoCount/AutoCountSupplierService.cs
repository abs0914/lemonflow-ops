using System;
using System.Collections.Generic;
using System.Data;
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

                    var acCreditor = cmd.NewCreditor();
                    MapDomainToCreditorEntity(supplier, acCreditor, userSession);
                    cmd.SaveCreditor(acCreditor, userSession.LoginUserID);

                    // Reload to get any AutoCount-assigned values
                    var reloaded = cmd.GetCreditor(supplier.Code);
                    return MapAutoCountCreditorToDomain(reloaded);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create supplier in AutoCount.", ex);
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

            // Set currency to account book local currency
            entity.CurrencyCode = global::AutoCount.Data.DBRegistry.Create(userSession.DBSetting)
                .GetString(new global::AutoCount.RegistryID.LocalCurrencyCode());
        }
    }
}


