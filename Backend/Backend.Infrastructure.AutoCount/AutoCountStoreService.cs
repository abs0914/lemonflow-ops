using System;
using System.Collections.Generic;
using System.Data;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountStoreService.
    /// Retrieves store information from AutoCount Debtors table.
    ///
    /// Store identification:
    /// - Debtors with codes starting with "STR-TLC-" are owned stores
    /// - Debtors with codes starting with "FRC-TLC-" are franchise locations
    /// </summary>
    public class AutoCountStoreService : IAutoCountStoreService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountStoreService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        public List<Store> GetAllStores()
        {
            return GetStoresInternal(null);
        }

        public List<Store> GetStoresByType(string storeType)
        {
            return GetStoresInternal(storeType);
        }

        public Store GetStoreByCode(string storeCode)
        {
            if (string.IsNullOrWhiteSpace(storeCode))
                return null;

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    string sql = string.Format(@"
                        SELECT AccNo, CompanyName, Address1, Address2, Address3, Address4,
                               Phone1, Email, IsActive, DebtorType
                        FROM Debtor
                        WHERE AccNo = '{0}'
                          AND (AccNo LIKE 'STR-TLC-%' OR AccNo LIKE 'FRC-TLC-%')",
                        storeCode.Replace("'", "''"));

                    DataTable dt = dbSetting.GetDataTable(sql, false);
                    if (dt.Rows.Count == 0)
                        return null;

                    return MapRowToStore(dt.Rows[0]);
                }
                catch
                {
                    return null;
                }
            }
        }

        public bool StoreExists(string storeCode)
        {
            return GetStoreByCode(storeCode) != null;
        }

        private List<Store> GetStoresInternal(string storeType)
        {
            var stores = new List<Store>();

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Build WHERE clause based on store type filter
                    string typeFilter = "";
                    if (!string.IsNullOrWhiteSpace(storeType))
                    {
                        if (storeType.Equals("own", StringComparison.OrdinalIgnoreCase))
                            typeFilter = " AND AccNo LIKE 'STR-TLC-%'";
                        else if (storeType.Equals("franchise", StringComparison.OrdinalIgnoreCase))
                            typeFilter = " AND AccNo LIKE 'FRC-TLC-%'";
                    }

                    string sql = string.Format(@"
                        SELECT AccNo, CompanyName, Address1, Address2, Address3, Address4,
                               Phone1, Email, IsActive, DebtorType
                        FROM Debtor
                        WHERE (AccNo LIKE 'STR-TLC-%' OR AccNo LIKE 'FRC-TLC-%'){0}
                        ORDER BY AccNo",
                        typeFilter);

                    DataTable dt = dbSetting.GetDataTable(sql, false);

                    foreach (DataRow row in dt.Rows)
                    {
                        var store = MapRowToStore(row);
                        if (store != null)
                            stores.Add(store);
                    }
                }
                catch
                {
                    // Return empty list on error
                }
            }

            return stores;
        }

        private Store MapRowToStore(DataRow row)
        {
            if (row == null)
                return null;

            string code = GetString(row, "AccNo");
            string storeType = "own";

            // Determine type from code prefix
            if (!string.IsNullOrEmpty(code))
            {
                if (code.StartsWith("FRC-TLC-", StringComparison.OrdinalIgnoreCase))
                    storeType = "franchise";
                else if (code.StartsWith("STR-TLC-", StringComparison.OrdinalIgnoreCase))
                    storeType = "own";
            }

            // Build address from address fields
            var addressParts = new List<string>();
            for (int i = 1; i <= 4; i++)
            {
                string addr = GetString(row, "Address" + i);
                if (!string.IsNullOrWhiteSpace(addr))
                    addressParts.Add(addr);
            }

            return new Store
            {
                Code = code,
                Name = GetString(row, "CompanyName"),
                Type = storeType,
                Address = string.Join(", ", addressParts),
                Phone = GetString(row, "Phone1"),
                Email = GetString(row, "Email"),
                IsActive = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"])
            };
        }

        private string GetString(DataRow row, string columnName)
        {
            if (row == null || !row.Table.Columns.Contains(columnName))
                return null;
            return row[columnName] != DBNull.Value ? row[columnName].ToString() : null;
        }
    }
}

