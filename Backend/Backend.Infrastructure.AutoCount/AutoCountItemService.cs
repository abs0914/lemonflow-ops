using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using AutoCount.Authentication;
using AutoCount.Data;
using AutoCount.Stock.Item;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Implementation of IAutoCountItemService using AutoCount 2.x stock item API.
    ///
    /// References:
    /// https://wiki.autocountsoft.com/wiki/Programmer:Stock_Item_v2
    /// </summary>
    public class AutoCountItemService : IAutoCountItemService
    {
        private readonly IAutoCountSessionProvider _sessionProvider;
        private readonly object _lockObject = new object();

        public AutoCountItemService(IAutoCountSessionProvider sessionProvider)
        {
            if (sessionProvider == null)
                throw new ArgumentNullException("sessionProvider");
            _sessionProvider = sessionProvider;
        }

        /// <inheritdoc />
        public List<StockItem> GetItems(int? limit = null)
        {
            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    // Query Item table for active ItemCode list (C# 5.0 compatible)
                    string sql = "SELECT ItemCode FROM Item WHERE IsActive='T'";
                    DataTable tblItemCode = dbSetting.GetDataTable(sql, false);

                    var itemCodeSet = new HashSet<string>();
                    foreach (DataRow r in tblItemCode.Rows)
                    {
                        if (r["ItemCode"] != DBNull.Value)
                        {
                            string code = r["ItemCode"].ToString();
                            if (!string.IsNullOrWhiteSpace(code))
                                itemCodeSet.Add(code);
                        }
                    }
                    var itemCodes = new List<string>(itemCodeSet);

                    if (limit.HasValue && limit.Value > 0 && itemCodes.Count > limit.Value)
                        itemCodes = itemCodes.GetRange(0, limit.Value);

                    if (itemCodes.Count == 0)
                        return new List<StockItem>();

                    // Get stock balances from vItemBalQty view
                    var balanceLookup = new Dictionary<string, decimal>();
                    try
                    {
                        string balanceSql = "SELECT ItemCode, SUM(BalQty) AS TotalBalance FROM vItemBalQty GROUP BY ItemCode";
                        DataTable tblBalance = dbSetting.GetDataTable(balanceSql, false);
                        foreach (DataRow balRow in tblBalance.Rows)
                        {
                            if (balRow["ItemCode"] != DBNull.Value && balRow["TotalBalance"] != DBNull.Value)
                            {
                                string itemCode = balRow["ItemCode"].ToString();
                                decimal balance = Convert.ToDecimal(balRow["TotalBalance"]);
                                balanceLookup[itemCode] = balance;
                            }
                        }
                    }
                    catch { }

                    var cmd = ItemDataAccess.Create(userSession, dbSetting);
                    ItemEntities items = cmd.LoadAllItem(itemCodes.ToArray());

                    var result = new List<StockItem>();
                    foreach (DataRow row in items.ItemTable.Rows)
                    {
                        var item = MapDataRowToStockItem(row);
                        if (item != null)
                        {
                            if (item.ItemCode != null && balanceLookup.ContainsKey(item.ItemCode))
                                item.StockBalance = balanceLookup[item.ItemCode];
                            result.Add(item);
                        }
                    }

                    return result;
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to retrieve items from AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public StockItem CreateItem(StockItem item)
        {
            if (item == null)
                throw new ArgumentNullException("item");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;

                    var cmd = ItemDataAccess.Create(userSession, dbSetting);
                    var entity = cmd.NewItem();

                    MapDomainToItemEntity(item, entity, dbSetting);

                    // For new items, AutoCount docs indicate recalculate flag is not required.
                    cmd.SaveData(entity);

                    // Reload to ensure we return what is stored.
                    var reloaded = cmd.LoadItem(entity.ItemCode, ItemEntryAction.Edit);
                    return MapItemEntityToDomain(reloaded);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to create stock item in AutoCount.", ex);
                }
            }
        }

        /// <inheritdoc />
        public StockItem UpdateItem(StockItem item)
        {
            if (item == null)
                throw new ArgumentNullException("item");
            if (string.IsNullOrWhiteSpace(item.ItemCode))
                throw new ArgumentException("ItemCode is required for update.", "item");

            lock (_lockObject)
            {
                try
                {
                    var userSession = _sessionProvider.GetUserSession();
                    var dbSetting = userSession.DBSetting;
                    var cmd = ItemDataAccess.Create(userSession, dbSetting);

                    var entity = cmd.LoadItem(item.ItemCode, ItemEntryAction.Edit);
                    if (entity == null)
                    {
                        throw new InvalidOperationException("Stock item '" + item.ItemCode + "' not found in AutoCount.");
                    }

                    MapDomainToItemEntity(item, entity, dbSetting, isUpdate: true);

                    cmd.SaveData(entity);

                    var reloaded = cmd.LoadItem(entity.ItemCode, ItemEntryAction.Edit);
                    return MapItemEntityToDomain(reloaded);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("Failed to update stock item '" + item.ItemCode + "' in AutoCount.", ex);
                }
            }
        }

        private StockItem MapDataRowToStockItem(DataRow row)
        {
            if (row == null)
                return null;
	   	 
	   	 	    var item = new StockItem
	   	 	    {
	   	 	        ItemCode = GetString(row, "ItemCode"),
	   	 	        Description = GetString(row, "Description"),
	   	 	        ItemGroup = GetString(row, "ItemGroup"),
	   	 	        ItemType = GetString(row, "ItemType"),
	   	 	        BaseUom = GetString(row, "BaseUOM"),
	   	 	        StockControl = GetBool(row, "StockControl", true),
	   	 	        HasBatchNo = GetBool(row, "HasBatchNo", false),
	   	 	        IsActive = GetBool(row, "IsActive", true),
	   	 	        StandardCost = GetDecimal(row, "StandardCost"),
	   	 	        Price = GetDecimal(row, "Price"),
	   	 	        StockBalance = GetDecimal(row, "StockBalance"),
	   	 	        MainSupplier = GetString(row, "MainSupplier"),
	   	 	        Barcode = GetString(row, "Barcode"),
	   	 	        HasBom = GetNullableBool(row, "HasBom")
	   	 	    };

	   	 	    return item;
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
	   	 	    if (value is bool) return (bool)value;
	   	 	    var s = value.ToString().Trim().ToUpperInvariant();
	   	 	    if (s == "T" || s == "Y" || s == "1" || s == "TRUE" || s == "YES") return true;
	   	 	    if (s == "F" || s == "N" || s == "0" || s == "FALSE" || s == "NO") return false;
	   	 	    return defaultValue;
	   	 	}

	   	 	private static bool? GetNullableBool(DataRow row, string columnName)
	   	 	{
	   	 	    if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
	   	 	        return null;
	   	 	    var value = row[columnName];
	   	 	    if (value is bool) return (bool)value;
	   	 	    var s = value.ToString().Trim().ToUpperInvariant();
	   	 	    if (s == "T" || s == "Y" || s == "1" || s == "TRUE" || s == "YES") return true;
	   	 	    if (s == "F" || s == "N" || s == "0" || s == "FALSE" || s == "NO") return false;
	   	 	    return null;
	   	 	}

	   	 	private static decimal? GetDecimal(DataRow row, string columnName)
	   	 	{
	   	 	    if (row == null || row.Table == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
	   	 	        return null;
	   	 
	   	 	    return Convert.ToDecimal(row[columnName]);
	   	 	}
	   	 
	   	 	private StockItem MapItemEntityToDomain(ItemEntity entity)
        {
            if (entity == null)
                return null;

            var baseUom = entity.BaseUomRecord;

            return new StockItem
            {
                ItemCode = entity.ItemCode,
                Description = entity.Description,
                ItemGroup = entity.ItemGroup,
                ItemType = entity.ItemType,
                BaseUom = baseUom != null ? baseUom.Uom : null,
                StockControl = entity.StockControl,
                HasBatchNo = entity.HasBatchNo,
                IsActive = entity.IsActive,
                StandardCost = baseUom != null ? (decimal?)baseUom.StandardCost : null,
                Price = baseUom != null ? (decimal?)baseUom.StandardSellingPrice : null,
                MainSupplier = entity.MainSupplier,
                Barcode = null,
                HasBom = null,
                StockBalance = null
            };
        }

        private void MapDomainToItemEntity(StockItem source, ItemEntity target, DBSetting dbSetting, bool isUpdate = false)
        {
            if (source == null)
                throw new ArgumentNullException("source");
            if (target == null)
                throw new ArgumentNullException("target");

            // For updates, AutoCount disallows changing ItemCode directly via ItemEntity; it
            // must be done via Change Item Code feature. We therefore only set ItemCode on
            // create.
            if (!isUpdate && !string.IsNullOrWhiteSpace(source.ItemCode))
            {
                target.ItemCode = source.ItemCode;
            }

            if (!string.IsNullOrWhiteSpace(source.Description))
                target.Description = source.Description;

            if (!string.IsNullOrWhiteSpace(source.ItemGroup))
                target.ItemGroup = source.ItemGroup;

            if (!string.IsNullOrWhiteSpace(source.ItemType))
                target.ItemType = source.ItemType;

            // UOM & pricing
            var baseUom = target.BaseUomRecord;
            if (baseUom == null && !string.IsNullOrWhiteSpace(source.BaseUom))
            {
                // When creating a new item, AutoCount auto-initialises a default UOM.
                // If present, we reset it to our desired base UOM.
                target.DeleteItemUom(0);
                baseUom = target.NewUom(source.BaseUom, 1);
            }

            if (baseUom != null)
            {
                if (!string.IsNullOrWhiteSpace(source.BaseUom))
                    baseUom.Uom = source.BaseUom;

                if (source.StandardCost.HasValue)
                    baseUom.StandardCost = source.StandardCost.Value;

                if (source.Price.HasValue)
                    baseUom.StandardSellingPrice = source.Price.Value;
            }

            // Flags
            target.StockControl = source.StockControl;
            target.HasBatchNo = source.HasBatchNo;
            target.IsActive = source.IsActive;

            if (!string.IsNullOrWhiteSpace(source.MainSupplier))
                target.MainSupplier = source.MainSupplier;

            // Barcode not available on ItemEntity

            // Costing method, tax types etc. are left to default account book settings.
        }
    }
}
