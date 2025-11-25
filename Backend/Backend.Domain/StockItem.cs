namespace Backend.Domain
{
    /// <summary>
    /// Domain model representing a stock item in AutoCount.
    ///
    /// This is a backend-only DTO; API controllers will project it into the
    /// exact JSON shape expected by Supabase Edge Functions.
    /// </summary>
    public class StockItem
    {
        public string ItemCode { get; set; }
        public string Description { get; set; }
        public string ItemGroup { get; set; }
        public string ItemType { get; set; }
        public string BaseUom { get; set; }

        public bool StockControl { get; set; }
        public bool HasBatchNo { get; set; }
        public bool IsActive { get; set; }

        public decimal? StandardCost { get; set; }
        public decimal? Price { get; set; }

        /// <summary>
        /// Current stock balance (in base UOM). Optional; may not be
        /// populated depending on how data is loaded from AutoCount.
        /// </summary>
        public decimal? StockBalance { get; set; }

        public string MainSupplier { get; set; }
        public string Barcode { get; set; }
        public bool? HasBom { get; set; }
    }
}
