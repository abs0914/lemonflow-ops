using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Abstraction over AutoCount Purchase Order API used by the
    /// Web API controller and tests.
    /// </summary>
    public interface IAutoCountPurchaseOrderService
    {
        /// <summary>
        /// Returns a list of purchase orders from AutoCount.
        /// </summary>
        /// <param name="limit">Optional limit on the number of results.</param>
        /// <returns>List of purchase orders.</returns>
        List<PurchaseOrder> GetPurchaseOrders(int? limit = null);

        /// <summary>
        /// Returns a single purchase order by document number.
        /// </summary>
        /// <param name="docNo">The document number.</param>
        /// <returns>The purchase order or null if not found.</returns>
        PurchaseOrder GetPurchaseOrder(string docNo);

        /// <summary>
        /// Creates a new purchase order document in AutoCount and
        /// returns the created document, including its final DocNo.
        /// </summary>
        PurchaseOrder CreatePurchaseOrder(PurchaseOrder purchaseOrder);

        /// <summary>
        /// Cancels an existing purchase order document by DocNo.
        /// Returns true on success.
        /// </summary>
        bool CancelPurchaseOrder(string documentNo);
    }
}
