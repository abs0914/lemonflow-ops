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
    }
}
