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
                throw new ArgumentException("Supplier code cannot be empty.", nameof(supplierCode));

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
                throw new ArgumentException("Supplier code cannot be empty.", nameof(supplierCode));

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

            string GetString(string columnName)
            {
                return row.Table.Columns.Contains(columnName) && row[columnName] != DBNull.Value
                    ? (string)row[columnName]
                    : null;
            }

            bool GetBool(string columnName, bool defaultValue)
            {
                return row.Table.Columns.Contains(columnName) && row[columnName] != DBNull.Value
                    ? Convert.ToBoolean(row[columnName])
                    : defaultValue;
            }

            var supplier = new Supplier
            {
                Code = GetString("AccNo"),
                CompanyName = GetString("CompanyName"),
                ContactPerson = GetString("Attention"),
                Phone = GetString("Phone1"),
                Email = GetString("EmailAddress"),
                Address = CombineAddress(GetString("Address1"), GetString("Address2")),
                // As with entity mapping, credit terms are not currently populated.
                CreditTerms = 0,
                IsActive = GetBool("IsActive", true)
            };

            return supplier;
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
    }
}

