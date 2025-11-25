using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Abstraction for AutoCount supplier (creditor) operations.
    /// For now this is read-only and used to sync suppliers out of AutoCount.
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
    }
}

