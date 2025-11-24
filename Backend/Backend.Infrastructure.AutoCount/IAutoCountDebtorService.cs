using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Service interface for Debtor (Customer) operations in AutoCount.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// 
    /// This service implements the "Interface with API – Web service" integration method,
    /// allowing external systems to read and write master data (Debtors) to AutoCount.
    /// </summary>
    public interface IAutoCountDebtorService
    {
        /// <summary>
        /// Retrieves all debtors from AutoCount.
        /// </summary>
        /// <returns>List of debtors.</returns>
        List<Debtor> GetAllDebtors();

        /// <summary>
        /// Retrieves a specific debtor by code.
        /// </summary>
        /// <param name="debtorCode">The debtor code.</param>
        /// <returns>The debtor, or null if not found.</returns>
        Debtor GetDebtorByCode(string debtorCode);

        /// <summary>
        /// Creates a new debtor in AutoCount.
        /// </summary>
        /// <param name="debtor">The debtor to create.</param>
        /// <returns>The created debtor with any auto-generated fields populated.</returns>
        Debtor CreateDebtor(Debtor debtor);

        /// <summary>
        /// Updates an existing debtor in AutoCount.
        /// </summary>
        /// <param name="debtor">The debtor to update.</param>
        /// <returns>The updated debtor.</returns>
        Debtor UpdateDebtor(Debtor debtor);

        /// <summary>
        /// Deletes a debtor from AutoCount.
        /// </summary>
        /// <param name="debtorCode">The debtor code to delete.</param>
        void DeleteDebtor(string debtorCode);

        /// <summary>
        /// Checks if a debtor exists.
        /// </summary>
        /// <param name="debtorCode">The debtor code.</param>
        /// <returns>True if the debtor exists, false otherwise.</returns>
        bool DebtorExists(string debtorCode);
    }
}

