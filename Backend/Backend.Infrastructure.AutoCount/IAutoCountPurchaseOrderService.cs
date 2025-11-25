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
