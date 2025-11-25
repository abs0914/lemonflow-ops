using System;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model representing a simple stock adjustment request/record
    /// originating from the Lemon-co app / Supabase function.
    ///
    /// This shape intentionally mirrors the payload used by the
    /// sync-stock-adjustment Supabase edge function, while remaining
    /// independent from any HTTP framework.
    /// </summary>
    public class StockAdjustment
    {
        public string ItemCode { get; set; }

        /// <summary>
        /// Optional warehouse/location code in AutoCount. The current
        /// implementation does not explicitly set this on the AutoCount
        /// document and instead relies on the item's default location.
        /// It is kept here so the information is not lost and can be
        /// used in descriptions/auditing or extended later.
        /// </summary>
        public string Location { get; set; }

        /// <summary>
        /// IN, OUT or SET. The implementation converts this into a
        /// positive or negative Qty value for AutoCount.
        /// </summary>
        public string AdjustmentType { get; set; }

        public decimal Quantity { get; set; }

        /// <summary>
        /// Unit of measure requested by the client. As with Location,
        /// the current implementation relies on the item's base UOM in
        /// AutoCount but retains this value for future extension.
        /// </summary>
        public string UOM { get; set; }

        public string Description { get; set; }

        public string BatchNumber { get; set; }

        public string Reason { get; set; }

        /// <summary>
        /// Document date in the client's timezone. When not supplied,
        /// the service will default to today's date.
        /// </summary>
        public DateTime? DocDate { get; set; }
    }
}
