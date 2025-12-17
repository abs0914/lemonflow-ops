using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Service interface for Store master data operations.
    /// Retrieves store information from AutoCount Debtors configured as stores.
    ///
    /// Stores are identified by naming convention:
    /// - Codes starting with "STR-TLC-" are owned stores (e.g., STR-TLC-004)
    /// - Codes starting with "FRC-TLC-" are franchise locations (e.g., FRC-TLC-001)
    /// </summary>
    public interface IAutoCountStoreService
    {
        /// <summary>
        /// Retrieves all stores (owned and franchise).
        /// </summary>
        /// <returns>List of all stores.</returns>
        List<Store> GetAllStores();

        /// <summary>
        /// Retrieves stores filtered by type.
        /// </summary>
        /// <param name="storeType">Store type: "own", "franchise", or null for all.</param>
        /// <returns>List of filtered stores.</returns>
        List<Store> GetStoresByType(string storeType);

        /// <summary>
        /// Retrieves a specific store by code.
        /// </summary>
        /// <param name="storeCode">The store code.</param>
        /// <returns>The store, or null if not found.</returns>
        Store GetStoreByCode(string storeCode);

        /// <summary>
        /// Checks if a store exists.
        /// </summary>
        /// <param name="storeCode">The store code.</param>
        /// <returns>True if the store exists, false otherwise.</returns>
        bool StoreExists(string storeCode);
    }
}

