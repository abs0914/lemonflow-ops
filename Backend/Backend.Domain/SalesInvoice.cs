using System;
using System.Collections.Generic;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model for a Sales Invoice in AutoCount Accounting.
    /// This represents the HTTP API model, separate from AutoCount's internal entities.
    /// </summary>
    public class SalesInvoice
    {
        /// <summary>
        /// Document number (unique identifier for the invoice).
        /// </summary>
        public string DocumentNo { get; set; }

        /// <summary>
        /// Debtor code (customer).
        /// </summary>
        public string DebtorCode { get; set; }

        /// <summary>
        /// Invoice date.
        /// </summary>
        public DateTime InvoiceDate { get; set; }

        /// <summary>
        /// Due date for payment.
        /// </summary>
        public DateTime DueDate { get; set; }

        /// <summary>
        /// Currency code (e.g., "USD", "MYR").
        /// </summary>
        public string CurrencyCode { get; set; }

        /// <summary>
        /// Exchange rate (if foreign currency).
        /// </summary>
        public decimal ExchangeRate { get; set; }

        /// <summary>
        /// Invoice line items.
        /// </summary>
        public List<SalesInvoiceLine> Lines { get; set; }

        /// <summary>
        /// Subtotal (before tax).
        /// </summary>
        public decimal Subtotal { get; set; }

        /// <summary>
        /// Total tax amount.
        /// Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"
        /// </summary>
        public decimal TaxAmount { get; set; }

        /// <summary>
        /// Total amount (including tax).
        /// </summary>
        public decimal Total { get; set; }

        /// <summary>
        /// Remarks or notes.
        /// </summary>
        public string Remarks { get; set; }

        /// <summary>
        /// Invoice status (e.g., "Draft", "Posted", "Cancelled").
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Date created.
        /// </summary>
        public DateTime CreatedDate { get; set; }

        /// <summary>
        /// Date last modified.
        /// </summary>
        public DateTime ModifiedDate { get; set; }
    }

    /// <summary>
    /// Represents a line item in a sales invoice.
    /// </summary>
    public class SalesInvoiceLine
    {
        /// <summary>
        /// Line number (sequence).
        /// </summary>
        public int LineNo { get; set; }

        /// <summary>
        /// Item code.
        /// </summary>
        public string ItemCode { get; set; }

        /// <summary>
        /// Item description.
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Quantity.
        /// </summary>
        public decimal Quantity { get; set; }

        /// <summary>
        /// Unit of measurement (e.g., "PCS", "BOX").
        /// </summary>
        public string UnitOfMeasure { get; set; }

        /// <summary>
        /// Unit price.
        /// </summary>
        public decimal UnitPrice { get; set; }

        /// <summary>
        /// Line amount (Quantity * UnitPrice).
        /// </summary>
        public decimal LineAmount { get; set; }

        /// <summary>
        /// Tax code (e.g., "SR" for Standard Rate, "ZR" for Zero Rate).
        /// Per AutoCount docs: Use AutoCount's helpers to resolve tax codes/rates.
        /// </summary>
        public string TaxCode { get; set; }

        /// <summary>
        /// Tax rate percentage (e.g., 6.0 for 6%).
        /// </summary>
        public decimal TaxRate { get; set; }

        /// <summary>
        /// Tax amount for this line.
        /// </summary>
        public decimal TaxAmount { get; set; }

        /// <summary>
        /// Remarks for this line.
        /// </summary>
        public string Remarks { get; set; }
    }
}

