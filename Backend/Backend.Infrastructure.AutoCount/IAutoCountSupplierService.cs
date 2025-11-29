using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Abstraction for AutoCount supplier (creditor) operations.
    /// Supports both read and write operations for supplier sync.
    /// </summary>
    public interface IAutoCountSupplierService
    {
        /// <summary>
        /// Retrieves all suppliers/creditors from AutoCount.
        /// </summary>
        /// <returns>List of suppliers.</returns>
        List<Supplier> GetAllSuppliers();

        /// <summary>
        /// Retrieves a single supplier by code.
        /// </summary>
        /// <param name="supplierCode">Supplier/creditor code.</param>
        /// <returns>Supplier if found; otherwise null.</returns>
        Supplier GetSupplierByCode(string supplierCode);

        /// <summary>
        /// Checks whether a supplier exists in AutoCount.
        /// </summary>
        /// <param name="supplierCode">Supplier/creditor code.</param>
        /// <returns>True if the supplier exists; otherwise false.</returns>
        bool SupplierExists(string supplierCode);

        /// <summary>
        /// Creates a new supplier in AutoCount.
        /// </summary>
        /// <param name="supplier">The supplier to create.</param>
        /// <returns>The created supplier with any AutoCount-assigned values.</returns>
        Supplier CreateSupplier(Supplier supplier);

        /// <summary>
        /// Updates an existing supplier in AutoCount.
        /// </summary>
        /// <param name="supplier">The supplier to update.</param>
        /// <returns>The updated supplier.</returns>
        Supplier UpdateSupplier(Supplier supplier);

        /// <summary>
        /// Deletes (deactivates) a supplier in AutoCount.
        /// AutoCount does not support hard deletes for creditors with transactions,
        /// so this sets IsActive = false.
        /// </summary>
        /// <param name="supplierCode">The supplier code to delete.</param>
        /// <returns>True if the supplier was deactivated; false if not found.</returns>
        bool DeleteSupplier(string supplierCode);
    }
}

