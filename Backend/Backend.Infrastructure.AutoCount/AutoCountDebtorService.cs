using System;
using System.Collections.Generic;
using Backend.Domain;
using AutoCount.ARAP.Debtor;
using AutoCount.SearchFilter;
using System.Data;

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

	                    // Ensure we are not creating a duplicate debtor.
	                    var existing = cmd.GetDebtor(debtor.Code);
	                    if (existing != null)
	                    {
	                        throw new InvalidOperationException("Debtor '" + debtor.Code + "' already exists in AutoCount.");
	                    }

	                    var acDebtor = cmd.NewDebtor();
	                    MapDomainDebtorToEntity(debtor, acDebtor, userSession);
	                    cmd.SaveDebtor(acDebtor, userSession.LoginUserID);

	                    return MapAutoCountDebtorToDomain(acDebtor);
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
	                CreditLimit = acDebtor.CreditLimit ?? 0m,
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
	                IsActive = row.Table.Columns.Contains("IsActive") && row["IsActive"] != DBNull.Value ? Convert.ToBoolean(row["IsActive"]) : true
	            };

	            return debtor;
	        }

	        private void MapDomainDebtorToEntity(Debtor source, DebtorEntity target, AutoCount.Authentication.UserSession userSession)
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
	                target.CurrencyCode = AutoCount.Data.DBRegistry.Create(userSession.DBSetting)
	                    .GetString(new AutoCount.RegistryID.LocalCurrencyCode());
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
    }
}

