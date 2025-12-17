using System;
using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Service interface for POS Daily Sales operations.
    /// Handles submission of daily sales summaries from POS terminals
    /// and syncs them to AutoCount as Cash Book Entry (OR - Official Receipt).
    ///
    /// This matches AutoCount POS native posting behavior:
    /// "This is to post the entries to AutoCount Accounting cash transaction (Cash Book Entry).
    /// The posting is daily based, which means one entry on each date."
    ///
    /// Document Types:
    /// - OR (Official Receipt) for cash/sales received
    /// - PV (Payment Voucher) for payments made
    /// </summary>
    public interface IAutoCountDailySalesService
    {
        /// <summary>
        /// Retrieves a list of daily sales records with optional filtering.
        /// </summary>
        /// <param name="startDate">Start date filter (inclusive).</param>
        /// <param name="endDate">End date filter (inclusive).</param>
        /// <param name="storeCode">Optional store code filter.</param>
        /// <param name="limit">Maximum records to return (default 100).</param>
        /// <returns>List of daily sales records.</returns>
        List<DailySales> GetDailySalesList(DateTime? startDate, DateTime? endDate, string storeCode, int? limit);
        /// <summary>
        /// Submits a daily sales batch from a POS terminal.
        /// Creates a Cash Book Entry (OR) in AutoCount with the aggregated sales data.
        /// Per AutoCount POS posting: all cash sales are posted as a lump sum per date.
        /// </summary>
        /// <param name="dailySales">The daily sales data to submit.</param>
        /// <returns>The processed daily sales with AutoCount document number.</returns>
        DailySales SubmitDailySales(DailySales dailySales);

        /// <summary>
        /// Retrieves a previously submitted daily sales record by POS reference.
        /// Used for idempotency checks and status queries.
        /// </summary>
        /// <param name="posReference">The POS-generated reference number.</param>
        /// <returns>The daily sales record, or null if not found.</returns>
        DailySales GetDailySalesByPosReference(string posReference);

        /// <summary>
        /// Retrieves a daily sales record by AutoCount document number.
        /// </summary>
        /// <param name="autoCountDocNo">The AutoCount invoice document number.</param>
        /// <returns>The daily sales record, or null if not found.</returns>
        DailySales GetDailySalesByDocNo(string autoCountDocNo);

        /// <summary>
        /// Checks if a daily sales submission already exists for the given POS reference.
        /// Used for idempotency - prevents duplicate submissions.
        /// </summary>
        /// <param name="posReference">The POS-generated reference number.</param>
        /// <returns>True if already submitted, false otherwise.</returns>
        bool DailySalesExists(string posReference);

        /// <summary>
        /// Validates the daily sales data before submission.
        /// Checks item codes exist, store code is valid, etc.
        /// </summary>
        /// <param name="dailySales">The daily sales data to validate.</param>
        /// <returns>Validation result with any error messages.</returns>
        DailySalesValidationResult ValidateDailySales(DailySales dailySales);
    }

    /// <summary>
    /// Result of daily sales validation.
    /// </summary>
    public class DailySalesValidationResult
    {
        /// <summary>
        /// Whether validation passed.
        /// </summary>
        public bool IsValid { get; set; }

        /// <summary>
        /// List of validation errors (if any).
        /// </summary>
        public string[] Errors { get; set; }

        /// <summary>
        /// List of warnings (non-blocking issues).
        /// </summary>
        public string[] Warnings { get; set; }
    }
}

