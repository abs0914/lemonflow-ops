using System;
using System.Collections.Generic;
using Backend.Domain;
using AutoCount.ARAP.Debtor;
using AutoCount.SearchFilter;
using System.Data;
using System.Data.SqlClient;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountDebtorService using AutoCount 2.1 API.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API
    /// 
    /// This service uses the shared UserSession (initialized via IAutoCountSessionProvider)
    /// to perform debtor operations. Thread-safe access to AutoCount is ensured by
    /// serializing calls through a lock, as AutoCount's thread-safety constraints are not
    /// fully documented.
    /// </summary>
    public class AutoCountDebtorService : IAutoCountDebtorService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountDebtorService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        public List<Debtor> GetAllDebtors()
        {
            lock (_lockObject)
            {
                try
                {
	                    var userSession = _sessionProvider.GetUserSession();
	                    var dbSetting = userSession.DBSetting;
	                    var debtors = new List<Debtor>();

	                    // Use DebtorDataAccess to load debtor data in bulk.
	                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);
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
	                        "CreditLimit",
	                        "IsActive"
	                    };

	                    DataTable table = cmd.LoadDebtorData(columns, criteria);
	                    foreach (DataRow row in table.Rows)
	                    {
	                        debtors.Add(MapDataRowToDebtor(row));
	                    }

	                    return debtors;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve debtors from AutoCount.", ex);
                }
            }
        }

        public Debtor GetDebtorByCode(string debtorCode)
        {
            if (string.IsNullOrWhiteSpace(debtorCode))
                throw new ArgumentException("Debtor code cannot be empty.", "debtorCode");

            lock (_lockObject)
            {
                try
                {
	                    var userSession = _sessionProvider.GetUserSession();
	                    var dbSetting = userSession.DBSetting;
	                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);
	                    var acDebtor = cmd.GetDebtor(debtorCode);
	                    if (acDebtor == null)
	                        return null;

	                    return MapAutoCountDebtorToDomain(acDebtor);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve debtor '" + debtorCode + "' from AutoCount.", ex);
                }
            }
        }

        public Debtor CreateDebtor(Debtor debtor)
        {
            if (debtor == null)
                throw new ArgumentNullException("debtor");
            if (string.IsNullOrWhiteSpace(debtor.Code))
                throw new ArgumentException("Debtor code is required.", "debtor");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;
                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);

                    // Check if debtor already exists (handle "not found" exception as normal case)
                    DebtorEntity existing = null;
                    try
                    {
                        existing = cmd.GetDebtor(debtor.Code);
                    }
                    catch (DebtorRecordNotFoundException)
                    {
                        // Debtor does not exist - this is expected for create, proceed normally
                        existing = null;
                    }

                    if (existing != null)
                    {
                        throw new InvalidOperationException("Debtor '" + debtor.Code + "' already exists in AutoCount.");
                    }

                    var acDebtor = cmd.NewDebtor();
                    MapDomainDebtorToEntity(debtor, acDebtor, userSession);

                    // SGEInvoicePeppolFormat is required by AutoCount database (Singapore e-invoicing).
                    // The field is not exposed in DebtorEntity API.
                    // Try to save, and if it fails due to SGEInvoicePeppolFormat, insert via raw SQL.
                    try
                    {
                        cmd.SaveDebtor(acDebtor, userSession.LoginUserID);
                    }
                    catch (Exception saveEx) when (ContainsSGEError(saveEx))
                    {
                        // AutoCount API doesn't expose this field - insert via raw SQL
                        InsertDebtorWithSGEField(dbSetting, debtor, userSession.LoginUserID);

                        // Reload the debtor to return the proper entity
                        acDebtor = cmd.GetDebtor(debtor.Code);
                        if (acDebtor == null)
                        {
                            throw new InvalidOperationException("Debtor was inserted but could not be retrieved.");
                        }
                    }

                    return MapAutoCountDebtorToDomain(acDebtor);
                }
                catch (InvalidOperationException)
                {
                    throw; // Re-throw our own exceptions
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create debtor in AutoCount.", ex);
                }
            }
        }

        public Debtor UpdateDebtor(Debtor debtor)
        {
            if (debtor == null)
                throw new ArgumentNullException("debtor");
            if (string.IsNullOrWhiteSpace(debtor.Code))
                throw new ArgumentException("Debtor code is required.", "debtor");

            lock (_lockObject)
            {
                try
                {
	                    var userSession = _sessionProvider.GetUserSession();
	                    var dbSetting = userSession.DBSetting;
	                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);
	                    var acDebtor = cmd.GetDebtor(debtor.Code);
	                    if (acDebtor == null)
	                    {
	                        throw new InvalidOperationException("Debtor '" + debtor.Code + "' not found in AutoCount.");
	                    }

	                    MapDomainDebtorToEntity(debtor, acDebtor, userSession);
	                    cmd.SaveDebtor(acDebtor, userSession.LoginUserID);

	                    return MapAutoCountDebtorToDomain(acDebtor);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to update debtor '" + debtor.Code + "' in AutoCount.", ex);
                }
            }
        }

        public void DeleteDebtor(string debtorCode)
        {
            if (string.IsNullOrWhiteSpace(debtorCode))
                throw new ArgumentException("Debtor code cannot be empty.", "debtorCode");

            lock (_lockObject)
            {
                try
                {
	                    var userSession = _sessionProvider.GetUserSession();
	                    var dbSetting = userSession.DBSetting;
	                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);
	                    var acDebtor = cmd.GetDebtor(debtorCode);
	                    if (acDebtor == null)
	                    {
	                        // If the debtor does not exist we treat it as already deleted.
	                        return;
	                    }

	                    // Soft-delete by inactivating the debtor, per AutoCount guidance.
	                    acDebtor.IsActive = false;
	                    cmd.SaveDebtor(acDebtor, userSession.LoginUserID);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to delete debtor '" + debtorCode + "' from AutoCount.", ex);
                }
            }
        }

	        public bool DebtorExists(string debtorCode)
	        {
	            if (string.IsNullOrWhiteSpace(debtorCode))
	                throw new ArgumentException("Debtor code cannot be empty.", "debtorCode");

	            lock (_lockObject)
	            {
	                try
	                {
	                    var userSession = _sessionProvider.GetUserSession();
	                    var dbSetting = userSession.DBSetting;
	                    var cmd = DebtorDataAccess.Create(userSession, dbSetting);
	                    var acDebtor = cmd.GetDebtor(debtorCode);
	                    return acDebtor != null;
	                }
	                catch
	                {
	                    return false;
	                }
	            }
	        }

	        private Debtor MapAutoCountDebtorToDomain(DebtorEntity acDebtor)
	        {
	            if (acDebtor == null)
	                return null;

	            var debtor = new Debtor
	            {
	                Code = acDebtor.AccNo,
	                Name = acDebtor.CompanyName,
	                Address1 = acDebtor.Address1,
	                Address2 = acDebtor.Address2,
	                ContactPerson = acDebtor.Attention,
	                Phone = acDebtor.Phone1,
	                Email = acDebtor.EmailAddress,
	                CreditLimit = acDebtor.CreditLimit,
	                CurrencyCode = acDebtor.CurrencyCode,
	                IsActive = acDebtor.IsActive
	            };

	            // Fields not directly represented in AutoCount DebtorEntity (city/state/postcode/country,
	            // tax registration, payment terms, remarks, timestamps) are left at their defaults.
	            return debtor;
	        }

	        private Debtor MapDataRowToDebtor(DataRow row)
	        {
	            if (row == null)
	                return null;

	            var debtor = new Debtor
	            {
	                Code = row.Table.Columns.Contains("AccNo") && row["AccNo"] != DBNull.Value ? (string)row["AccNo"] : null,
	                Name = row.Table.Columns.Contains("CompanyName") && row["CompanyName"] != DBNull.Value ? (string)row["CompanyName"] : null,
	                Address1 = row.Table.Columns.Contains("Address1") && row["Address1"] != DBNull.Value ? (string)row["Address1"] : null,
	                Address2 = row.Table.Columns.Contains("Address2") && row["Address2"] != DBNull.Value ? (string)row["Address2"] : null,
	                ContactPerson = row.Table.Columns.Contains("Attention") && row["Attention"] != DBNull.Value ? (string)row["Attention"] : null,
	                Phone = row.Table.Columns.Contains("Phone1") && row["Phone1"] != DBNull.Value ? (string)row["Phone1"] : null,
	                Email = row.Table.Columns.Contains("EmailAddress") && row["EmailAddress"] != DBNull.Value ? (string)row["EmailAddress"] : null,
	                CreditLimit = row.Table.Columns.Contains("CreditLimit") && row["CreditLimit"] != DBNull.Value ? Convert.ToDecimal(row["CreditLimit"]) : 0m,
	                IsActive = ParseIsActive(row)
	            };

	            return debtor;
	        }

	        /// <summary>
	        /// Safely parses the IsActive column which may be stored as various types
	        /// (bool, string "T"/"F", int 1/0, etc.) depending on AutoCount version.
	        /// </summary>
	        private bool ParseIsActive(DataRow row)
	        {
	            if (!row.Table.Columns.Contains("IsActive") || row["IsActive"] == DBNull.Value)
	                return true;

	            var value = row["IsActive"];

	            // Handle bool directly
	            if (value is bool)
	                return (bool)value;

	            // Handle numeric (1/0)
	            if (value is int || value is short || value is byte || value is long)
	                return Convert.ToInt64(value) != 0;

	            // Handle string representations
	            var strValue = value.ToString().Trim().ToUpperInvariant();
	            if (strValue == "T" || strValue == "TRUE" || strValue == "Y" || strValue == "YES" || strValue == "1")
	                return true;
	            if (strValue == "F" || strValue == "FALSE" || strValue == "N" || strValue == "NO" || strValue == "0")
	                return false;

	            // Default to true if we can't parse
	            return true;
	        }

	        private void MapDomainDebtorToEntity(Debtor source, DebtorEntity target, global::AutoCount.Authentication.UserSession userSession)
	        {
	            if (source == null)
	                throw new ArgumentNullException("source");
	            if (target == null)
	                throw new ArgumentNullException("target");

	            // Required fields
	            target.AccNo = source.Code;
	            target.CompanyName = source.Name;
	            target.Address1 = source.Address1;
	            target.Address2 = source.Address2;
	            target.Phone1 = source.Phone;
	            target.Attention = source.ContactPerson;
	            target.EmailAddress = source.Email;
	            target.IsActive = source.IsActive;

	            // Use account book local currency when no currency is specified.
	            if (string.IsNullOrWhiteSpace(source.CurrencyCode))
	            {
	                target.CurrencyCode = global::AutoCount.Data.DBRegistry.Create(userSession.DBSetting)
	                    .GetString(new global::AutoCount.RegistryID.LocalCurrencyCode());
	            }
	            else
	            {
	                target.CurrencyCode = source.CurrencyCode;
	            }

	            // Credit limit is optional; zero is treated as "no limit" according to account book settings.
	            if (source.CreditLimit > 0)
	            {
	                target.CreditLimit = source.CreditLimit;
	            }
	        }

	        /// <summary>
	        /// Sets a database field on the DebtorEntity that isn't directly exposed as a property.
	        /// Uses reflection to access the internal DataRow.
	        /// </summary>
	        private void SetDebtorFieldViaReflection(DebtorEntity entity, string fieldName, object value)
	        {
	            try
	            {
	                // Try to find a DataRow property or field via reflection
	                var type = entity.GetType();

	                // Look for common patterns in AutoCount entities
	                var propNames = new[] { "DataRow", "Row", "MasterRow", "drMaster" };
	                foreach (var propName in propNames)
	                {
	                    var prop = type.GetProperty(propName,
	                        System.Reflection.BindingFlags.Public |
	                        System.Reflection.BindingFlags.NonPublic |
	                        System.Reflection.BindingFlags.Instance);
	                    if (prop != null && typeof(DataRow).IsAssignableFrom(prop.PropertyType))
	                    {
	                        var row = prop.GetValue(entity) as DataRow;
	                        if (row != null && row.Table.Columns.Contains(fieldName))
	                        {
	                            row[fieldName] = value;
	                            return;
	                        }
	                    }

	                    var field = type.GetField(propName,
	                        System.Reflection.BindingFlags.Public |
	                        System.Reflection.BindingFlags.NonPublic |
	                        System.Reflection.BindingFlags.Instance);
	                    if (field != null && typeof(DataRow).IsAssignableFrom(field.FieldType))
	                    {
	                        var row = field.GetValue(entity) as DataRow;
	                        if (row != null && row.Table.Columns.Contains(fieldName))
	                        {
	                            row[fieldName] = value;
	                            return;
	                        }
	                    }
	                }

	                // If reflection fails, try to find a DataTable property
	                var tableProps = new[] { "MasterTable", "Table", "DataTable" };
	                foreach (var tablePropName in tableProps)
	                {
	                    var prop = type.GetProperty(tablePropName,
	                        System.Reflection.BindingFlags.Public |
	                        System.Reflection.BindingFlags.NonPublic |
	                        System.Reflection.BindingFlags.Instance);
	                    if (prop != null && typeof(DataTable).IsAssignableFrom(prop.PropertyType))
	                    {
	                        var table = prop.GetValue(entity) as DataTable;
	                        if (table != null && table.Columns.Contains(fieldName) && table.Rows.Count > 0)
	                        {
	                            table.Rows[0][fieldName] = value;
	                            return;
	                        }
	                    }
	                }
	            }
	            catch
	            {
	                // If reflection fails, silently continue - the save will fail with a more specific error
	            }
	        }

	        /// <summary>
	        /// Ensures the SGEInvoicePeppolFormat column has a default constraint in the database.
	        /// This is required because AutoCount's API doesn't expose this field but the database requires it.
	        /// </summary>
	        private static bool _sgeDefaultEnsured = false;
	        private static readonly object _sgeDefaultLock = new object();

        private void EnsureSGEInvoicePeppolFormatDefault(global::AutoCount.Data.DBSetting dbSetting)
        {
            if (_sgeDefaultEnsured) return;

            lock (_sgeDefaultLock)
            {
                if (_sgeDefaultEnsured) return;

                try
                {
                    // Use direct SqlConnection to execute DDL - dbSetting.ExecuteNonQuery may not exist
                    string connStr = dbSetting.ConnectionString;
                    using (var conn = new SqlConnection(connStr))
                    {
                        conn.Open();

                        // Check if the column exists and add a default constraint if it doesn't have one
                        string checkSql = @"
                            IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                                       WHERE TABLE_NAME = 'AR_Customer' AND COLUMN_NAME = 'SGEInvoicePeppolFormat')
                            BEGIN
                                IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
                                               JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                                               WHERE c.name = 'SGEInvoicePeppolFormat' AND OBJECT_NAME(dc.parent_object_id) = 'AR_Customer')
                                BEGIN
                                    ALTER TABLE AR_Customer ADD CONSTRAINT DF_AR_Customer_SGEInvoicePeppolFormat DEFAULT '' FOR SGEInvoicePeppolFormat
                                END
                            END";

                        using (var cmd = new SqlCommand(checkSql, conn))
                        {
                            cmd.ExecuteNonQuery();
                        }
                    }
                    _sgeDefaultEnsured = true;
                }
                catch
                {
                    // If we can't add the constraint, continue anyway - the save might still work
                    // or fail with a more specific error
                }
            }
        }

        /// <summary>
        /// Inserts a debtor directly via SQL when the AutoCount API fails due to SGEInvoicePeppolFormat.
        /// This is a workaround for AutoCount databases that have Singapore e-invoicing fields.
        /// </summary>
        private void InsertDebtorWithSGEField(global::AutoCount.Data.DBSetting dbSetting, Debtor debtor, string userId)
        {
            string connStr = dbSetting.ConnectionString;
            using (var conn = new SqlConnection(connStr))
            {
                conn.Open();

                // Insert minimal debtor record with SGEInvoicePeppolFormat set to empty string
                // SGEInvoicePeppolFormat requires 'SG-Peppol-1.0' for Singapore IMDA standard
                string insertSql = @"
                    INSERT INTO AR_Customer (
                        AccNo, CompanyName, IsActive, CurrencyCode,
                        Contact, Phone1, Email, Address1,
                        SGEInvoicePeppolFormat,
                        CreatedUserID, CreatedTimeStamp, LastModifiedUserID, LastModifiedTimeStamp
                    ) VALUES (
                        @AccNo, @CompanyName, @IsActive, @CurrencyCode,
                        @Contact, @Phone1, @Email, @Address1,
                        'SG-Peppol-1.0',
                        @UserID, GETDATE(), @UserID, GETDATE()
                    )";

                using (var cmd = new SqlCommand(insertSql, conn))
                {
                    cmd.Parameters.AddWithValue("@AccNo", debtor.Code ?? string.Empty);
                    cmd.Parameters.AddWithValue("@CompanyName", debtor.Name ?? string.Empty);
                    cmd.Parameters.AddWithValue("@IsActive", debtor.IsActive ? "T" : "F");
                    cmd.Parameters.AddWithValue("@CurrencyCode", debtor.CurrencyCode ?? "PHP");
                    cmd.Parameters.AddWithValue("@Contact", debtor.ContactPerson ?? string.Empty);
                    cmd.Parameters.AddWithValue("@Phone1", debtor.Phone ?? string.Empty);
                    cmd.Parameters.AddWithValue("@Email", debtor.Email ?? string.Empty);
                    cmd.Parameters.AddWithValue("@Address1", debtor.Address1 ?? string.Empty);
                    cmd.Parameters.AddWithValue("@UserID", userId ?? "ABORJA");

                    cmd.ExecuteNonQuery();
                }
            }
        }

        /// <summary>
        /// Checks if any exception in the chain contains the SGEInvoicePeppolFormat error.
        /// </summary>
        private static bool ContainsSGEError(Exception ex)
        {
            var current = ex;
            while (current != null)
            {
                if (current.Message != null &&
                    current.Message.IndexOf("SGEInvoicePeppolFormat", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return true;
                }
                current = current.InnerException;
            }
            return false;
        }
    }
}

