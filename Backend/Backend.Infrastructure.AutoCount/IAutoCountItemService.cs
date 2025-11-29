using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Abstraction over AutoCount stock item operations used by the Web API.
    /// </summary>
    public interface IAutoCountItemService
    {
        /// <summary>
        /// Returns a list of stock items from AutoCount. The implementation may
        /// apply additional filters (e.g. IsActive = true) and may ignore
        /// <paramref name="limit" /> if not supported efficiently.
        /// </summary>
        List<StockItem> GetItems(int? limit = null);

        /// <summary>
        /// Creates a new stock item in AutoCount and returns the created item
        /// as read back from AutoCount.
        /// </summary>
        StockItem CreateItem(StockItem item);

        /// <summary>
        /// Updates an existing stock item in AutoCount and returns the updated
        /// item as read back from AutoCount.
        /// </summary>
        StockItem UpdateItem(StockItem item);

        /// <summary>
        /// Deletes (deactivates) a stock item in AutoCount.
        /// AutoCount does not support hard deletes for items with transactions,
        /// so this sets IsActive = false.
        /// </summary>
        /// <param name="itemCode">The item code to delete.</param>
        /// <returns>True if the item was deactivated; false if not found.</returns>
        bool DeleteItem(string itemCode);
    }
}
