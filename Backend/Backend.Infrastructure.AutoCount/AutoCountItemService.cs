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

                    // Strategy based on official sample "GetModifiedItemData":
                    //   1. Query Item table for active ItemCode list
                    //   2. Use ItemDataAccess.LoadAllItem(string[]) to get full item data

                    string sql = "SELECT ItemCode FROM Item WHERE IsActive='T'";
                    DataTable tblItemCode = dbSetting.GetDataTable(sql, false);

                    var itemCodes = tblItemCode
                        .AsEnumerable()
                        .Select(r => r.Field<string>("ItemCode"))
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Distinct()
                        .ToList();

                    if (limit.HasValue && limit.Value > 0 && itemCodes.Count > limit.Value)
                    {
                        itemCodes = itemCodes.Take(limit.Value).ToList();
                    }

                    if (itemCodes.Count == 0)
                        return new List<StockItem>();

                    var cmd = ItemDataAccess.Create(userSession, dbSetting);
                    ItemEntities items = cmd.LoadAllItem(itemCodes.ToArray());

                    var result = new List<StockItem>();
                    var table = items.ItemTable;
                    foreach (DataRow row in table.Rows)
                    {
                        var item = MapDataRowToStockItem(row);
                        if (item != null)
                        {
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

            decimal? GetDecimal(string columnName)
            {
                if (!row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
                    return null;

                return Convert.ToDecimal(row[columnName]);
            }

            var item = new StockItem
            {
                ItemCode = GetString("ItemCode"),
                Description = GetString("Description"),
                ItemGroup = GetString("ItemGroup"),
                ItemType = GetString("ItemType"),
                BaseUom = GetString("BaseUOM"),
                StockControl = GetBool("StockControl", true),
                HasBatchNo = GetBool("HasBatchNo", false),
                IsActive = GetBool("IsActive", true),
                StandardCost = GetDecimal("StandardCost"),
                Price = GetDecimal("Price"),
                StockBalance = GetDecimal("StockBalance"),
                MainSupplier = GetString("MainSupplier"),
                Barcode = GetString("Barcode"),
                HasBom = row.Table.Columns.Contains("HasBom") && row["HasBom"] != DBNull.Value
                    ? (bool?)Convert.ToBoolean(row["HasBom"])
                    : null
            };

            return item;
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
                StandardCost = baseUom != null ? baseUom.StandardCost : null,
                Price = baseUom != null ? baseUom.StandardSellingPrice : null,
                MainSupplier = entity.MainSupplier,
                Barcode = entity.Barcode,
                // StockBalance and HasBom are not directly available from ItemEntity; leave null/false.
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

            if (!string.IsNullOrWhiteSpace(source.Barcode))
                target.Barcode = source.Barcode;

            // Costing method, tax types etc. are left to default account book settings.
        }
    }
}
