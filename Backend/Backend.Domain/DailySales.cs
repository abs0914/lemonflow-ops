using System;
using System.Collections.Generic;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model for POS Daily Sales submission.
    /// Represents aggregated sales data from a store's POS system for a single day.
    ///
    /// Posts to AutoCount as Cash Book Entry (OR - Official Receipt) to match
    /// AutoCount POS native posting behavior. Per AutoCount documentation:
    /// "This is to post the entries to AutoCount Accounting cash transaction (Cash Book Entry).
    /// The posting is daily based, which means one entry on each date."
    ///
    /// Document Types:
    /// - OR (Official Receipt) for cash/sales received
    /// - PV (Payment Voucher) for payments made
    /// </summary>
    public class DailySales
    {
        /// <summary>
        /// Document type for Cash Book Entry.
        /// Default: "OR" (Official Receipt / Cash Receipt)
        /// </summary>
        public string DocumentType { get; set; } = "OR";
        /// <summary>
        /// Store identifier code (maps to AutoCount debtor code).
        /// Example: "STORE-SM-001", "FRAN-ABC-001"
        /// </summary>
        public string StoreCode { get; set; }

        /// <summary>
        /// Cash register or terminal identifier.
        /// Example: "REG-01", "POS-MAIN"
        /// </summary>
        public string CashRegisterId { get; set; }

        /// <summary>
        /// Date of sales (business date, not submission date).
        /// Format: YYYY-MM-DD
        /// </summary>
        public DateTime SalesDate { get; set; }

        /// <summary>
        /// Shift identifier (optional).
        /// Example: "MORNING", "AFTERNOON", "EVENING", "ALL_DAY"
        /// </summary>
        public string Shift { get; set; }

        /// <summary>
        /// POS-generated reference number for this daily sales batch.
        /// Used for idempotency - prevents duplicate submissions.
        /// Example: "POS-SM001-20241216-001"
        /// </summary>
        public string PosReference { get; set; }

        /// <summary>
        /// Individual sales transactions or aggregated line items.
        /// </summary>
        public List<DailySalesLine> Lines { get; set; }

        /// <summary>
        /// Payment breakdown by method.
        /// </summary>
        public List<PaymentBreakdown> Payments { get; set; }

        /// <summary>
        /// Operator/cashier who closed the shift or day.
        /// </summary>
        public string OperatorId { get; set; }

        /// <summary>
        /// Operator name for reference.
        /// </summary>
        public string OperatorName { get; set; }

        /// <summary>
        /// Additional notes or remarks.
        /// </summary>
        public string Remarks { get; set; }

        /// <summary>
        /// Currency code. Default: PHP
        /// </summary>
        public string CurrencyCode { get; set; }

        /// <summary>
        /// G/L Account for sales posting (optional - uses system default if not provided).
        /// Example: "400-0000" for sales account.
        /// </summary>
        public string SalesGLAccount { get; set; }

        /// <summary>
        /// G/L Account for cash/bank posting (optional - uses system default if not provided).
        /// Example: "100-0001" for cash account, "100-0002" for bank account.
        /// </summary>
        public string CashBankGLAccount { get; set; }

        /// <summary>
        /// Location code for multi-location posting.
        /// Maps to AutoCount Location Maintenance settings.
        /// </summary>
        public string LocationCode { get; set; }

        // === Response fields (populated after creation) ===

        /// <summary>
        /// AutoCount document number assigned after sync.
        /// </summary>
        public string AutoCountDocNo { get; set; }

        /// <summary>
        /// Calculated subtotal (before tax).
        /// </summary>
        public decimal Subtotal { get; set; }

        /// <summary>
        /// Calculated total tax amount.
        /// </summary>
        public decimal TaxAmount { get; set; }

        /// <summary>
        /// Calculated grand total.
        /// </summary>
        public decimal GrandTotal { get; set; }

        /// <summary>
        /// Total discount applied.
        /// </summary>
        public decimal TotalDiscount { get; set; }

        /// <summary>
        /// Processing status: "pending", "synced", "failed"
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Error message if sync failed.
        /// </summary>
        public string ErrorMessage { get; set; }

        /// <summary>
        /// Timestamp when synced to AutoCount.
        /// </summary>
        public DateTime? SyncedAt { get; set; }
    }

    /// <summary>
    /// Individual line item in a daily sales submission.
    /// Can represent aggregated product sales or individual transactions.
    /// </summary>
    public class DailySalesLine
    {
        /// <summary>
        /// Line sequence number.
        /// </summary>
        public int LineNo { get; set; }

        /// <summary>
        /// Product SKU/item code (must exist in AutoCount).
        /// </summary>
        public string ItemCode { get; set; }

        /// <summary>
        /// Product description/name.
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Quantity sold.
        /// </summary>
        public decimal Quantity { get; set; }

        /// <summary>
        /// Unit of measure. Default: "PCS"
        /// </summary>
        public string UnitOfMeasure { get; set; }

        /// <summary>
        /// Unit selling price.
        /// </summary>
        public decimal UnitPrice { get; set; }

        /// <summary>
        /// Discount amount or percentage string (e.g., "10%" or "5.00").
        /// </summary>
        public string Discount { get; set; }

        /// <summary>
        /// Line subtotal after discount (Qty * UnitPrice - Discount).
        /// </summary>
        public decimal LineAmount { get; set; }

        /// <summary>
        /// Tax code (e.g., "SR" for standard rate, "ZR" for zero-rated).
        /// </summary>
        public string TaxCode { get; set; }

        /// <summary>
        /// Tax rate percentage.
        /// </summary>
        public decimal TaxRate { get; set; }

        /// <summary>
        /// Tax amount for this line.
        /// </summary>
        public decimal TaxAmount { get; set; }

        /// <summary>
        /// Product category for reporting.
        /// </summary>
        public string Category { get; set; }

        /// <summary>
        /// Line remarks/notes.
        /// </summary>
        public string Remarks { get; set; }
    }

    /// <summary>
    /// Payment method breakdown for daily sales reconciliation.
    /// </summary>
    public class PaymentBreakdown
    {
        /// <summary>
        /// Payment method type.
        /// Values: "CASH", "CREDIT_CARD", "DEBIT_CARD", "GCASH", "MAYA", "GRAB_PAY", "FOOD_PANDA", "OTHER"
        /// </summary>
        public string PaymentMethod { get; set; }

        /// <summary>
        /// Amount received via this payment method.
        /// </summary>
        public decimal Amount { get; set; }

        /// <summary>
        /// Reference number (for card/e-wallet transactions).
        /// </summary>
        public string ReferenceNo { get; set; }

        /// <summary>
        /// Number of transactions using this payment method.
        /// </summary>
        public int TransactionCount { get; set; }

        /// <summary>
        /// Additional details or notes.
        /// </summary>
        public string Notes { get; set; }
    }
}
