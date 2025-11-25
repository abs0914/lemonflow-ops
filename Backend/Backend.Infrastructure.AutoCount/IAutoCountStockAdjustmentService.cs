using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Abstraction over AutoCount Stock Adjustment API used by the
    /// Web API controller and tests.
    /// </summary>
    public interface IAutoCountStockAdjustmentService
    {
        /// <summary>
        /// Creates a new stock adjustment document in AutoCount and
        /// returns the resulting document number.
        /// </summary>
        string CreateStockAdjustment(StockAdjustment adjustment);

        /// <summary>
        /// Attempts to cancel an existing stock adjustment document.
        /// Returns true on success.
        /// </summary>
        bool CancelStockAdjustment(string documentNo);
    }
}
