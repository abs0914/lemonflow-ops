using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Service interface for Sales Invoice operations in AutoCount.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// 
    /// This service implements the "Interface with API – Web service" integration method,
    /// allowing external systems to read and write transaction documents (Sales Invoices) to AutoCount.
    /// 
    /// Tax Code Handling:
    /// Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"
    /// https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#GST_Tax_Code_and_Tax_Rate
    /// SubProjectStartup must have been called at app start to enable tax code resolution.
    /// </summary>
    public interface IAutoCountSalesInvoiceService
    {
        /// <summary>
        /// Retrieves a sales invoice by document number.
        /// </summary>
        /// <param name="documentNo">The document number.</param>
        /// <returns>The sales invoice, or null if not found.</returns>
        SalesInvoice GetSalesInvoiceByDocumentNo(string documentNo);

        /// <summary>
        /// Creates a new sales invoice in AutoCount.
        /// </summary>
        /// <param name="invoice">The sales invoice to create.</param>
        /// <returns>The created invoice with any auto-generated fields populated.</returns>
        SalesInvoice CreateSalesInvoice(SalesInvoice invoice);

        /// <summary>
        /// Updates an existing sales invoice in AutoCount.
        /// </summary>
        /// <param name="invoice">The sales invoice to update.</param>
        /// <returns>The updated invoice.</returns>
        SalesInvoice UpdateSalesInvoice(SalesInvoice invoice);

        /// <summary>
        /// Posts (finalizes) a sales invoice in AutoCount.
        /// </summary>
        /// <param name="documentNo">The document number to post.</param>
        void PostSalesInvoice(string documentNo);

        /// <summary>
        /// Checks if a sales invoice exists.
        /// </summary>
        /// <param name="documentNo">The document number.</param>
        /// <returns>True if the invoice exists, false otherwise.</returns>
        bool SalesInvoiceExists(string documentNo);

        /// <summary>
        /// Gets the available tax codes from AutoCount.
        /// Per AutoCount docs: Use AutoCount's helpers to resolve tax codes/rates.
        /// </summary>
        /// <returns>Array of available tax codes.</returns>
        string[] GetAvailableTaxCodes();

        /// <summary>
        /// Gets the tax rate for a specific tax code.
        /// </summary>
        /// <param name="taxCode">The tax code (e.g., "SR", "ZR").</param>
        /// <returns>The tax rate as a percentage (e.g., 6.0 for 6%).</returns>
        decimal GetTaxRate(string taxCode);
    }
}

