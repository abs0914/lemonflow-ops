using System;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// REST API controller for Sales Invoice operations.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// 
    /// This controller implements the "Interface with API – Web service" integration method,
    /// exposing endpoints for reading and writing transaction documents (Sales Invoices) to AutoCount.
    /// 
    /// Tax Code Handling:
    /// Per AutoCount docs: "GovernmentTaxCode replaces older IRASTaxCode naming"
    /// https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#GST_Tax_Code_and_Tax_Rate
    /// </summary>
    [RoutePrefix("api/sales-invoices")]
    public class SalesInvoicesController : ApiController
    {
        private readonly IAutoCountSalesInvoiceService _invoiceService;

        // Parameterless constructor for Web API default activator
        public SalesInvoicesController()
            : this(new AutoCountSalesInvoiceService(AutoCountSessionProvider.Instance))
        {
        }

        public SalesInvoicesController(IAutoCountSalesInvoiceService invoiceService)
        {
            if (invoiceService == null)
                throw new ArgumentNullException("invoiceService");
            _invoiceService = invoiceService;
        }

        /// <summary>
        /// GET /api/sales-invoices/{documentNo}
        /// Retrieves a specific sales invoice by document number.
        /// </summary>
        /// <param name="documentNo">The document number.</param>
        [HttpGet]
        [Route("{documentNo}")]
        public IHttpActionResult GetSalesInvoice(string documentNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(documentNo))
                    return BadRequest("Document number is required");

                var invoice = _invoiceService.GetSalesInvoiceByDocumentNo(documentNo);
                if (invoice == null)
                    return NotFound();

                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /api/sales-invoices
        /// Creates a new sales invoice in AutoCount.
        /// </summary>
        /// <param name="invoice">The sales invoice to create.</param>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateSalesInvoice([FromBody] SalesInvoice invoice)
        {
            try
            {
                if (invoice == null)
                    return BadRequest("Invoice data is required");

                if (string.IsNullOrWhiteSpace(invoice.DebtorCode))
                    return BadRequest("Debtor code is required");

                if (invoice.Lines == null || invoice.Lines.Count == 0)
                    return BadRequest("Invoice must have at least one line item");

                var createdInvoice = _invoiceService.CreateSalesInvoice(invoice);
                return Created("api/sales-invoices/" + createdInvoice.DocumentNo, createdInvoice);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// PUT /api/sales-invoices/{documentNo}
        /// Updates an existing sales invoice in AutoCount.
        /// </summary>
        /// <param name="documentNo">The document number.</param>
        /// <param name="invoice">The updated invoice data.</param>
        [HttpPut]
        [Route("{documentNo}")]
        public IHttpActionResult UpdateSalesInvoice(string documentNo, [FromBody] SalesInvoice invoice)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(documentNo))
                    return BadRequest("Document number is required");

                if (invoice == null)
                    return BadRequest("Invoice data is required");

                if (invoice.DocumentNo != documentNo)
                    return BadRequest("Document number in URL does not match body");

                var updatedInvoice = _invoiceService.UpdateSalesInvoice(invoice);
                return Ok(updatedInvoice);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /api/sales-invoices/{documentNo}/post
        /// Posts (finalizes) a sales invoice in AutoCount.
        /// </summary>
        /// <param name="documentNo">The document number to post.</param>
        [HttpPost]
        [Route("{documentNo}/post")]
        public IHttpActionResult PostSalesInvoice(string documentNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(documentNo))
                    return BadRequest("Document number is required");

                if (!_invoiceService.SalesInvoiceExists(documentNo))
                    return NotFound();

                _invoiceService.PostSalesInvoice(documentNo);
                return Ok(new { message = "Sales invoice '" + documentNo + "' posted successfully" });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/sales-invoices/tax-codes
        /// Retrieves available tax codes from AutoCount.
        /// Per AutoCount docs: Use AutoCount's helpers to resolve tax codes/rates.
        /// </summary>
        [HttpGet]
        [Route("tax-codes")]
        public IHttpActionResult GetTaxCodes()
        {
            try
            {
                var taxCodes = _invoiceService.GetAvailableTaxCodes();
                return Ok(new { tax_codes = taxCodes });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/sales-invoices/tax-rate/{taxCode}
        /// Gets the tax rate for a specific tax code.
        /// </summary>
        /// <param name="taxCode">The tax code (e.g., "SR", "ZR").</param>
        [HttpGet]
        [Route("tax-rate/{taxCode}")]
        public IHttpActionResult GetTaxRate(string taxCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(taxCode))
                    return BadRequest("Tax code is required");

                var rate = _invoiceService.GetTaxRate(taxCode);
                return Ok(new { tax_code = taxCode, tax_rate = rate });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}

