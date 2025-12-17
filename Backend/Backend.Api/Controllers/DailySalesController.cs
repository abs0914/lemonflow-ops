using System;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// REST API controller for POS Daily Sales operations.
    /// 
    /// This endpoint is designed for POS (Point of Sale) frontend applications
    /// to submit daily sales data from stores and franchisee stores.
    /// 
    /// Integration Method: Cash Book Entry (OR - Official Receipt)
    /// This matches AutoCount POS native posting behavior:
    /// "This is to post the entries to AutoCount Accounting cash transaction (Cash Book Entry).
    /// The posting is daily based, which means one entry on each date.
    /// All cash sales will be posted as a lump sum in each specific date."
    /// 
    /// Document Types:
    /// - OR (Official Receipt) for cash/sales received
    /// - PV (Payment Voucher) for payments made (not used for sales)
    /// </summary>
    [RoutePrefix("api/pos/daily-sales")]
    public class DailySalesController : ApiController
    {
        private readonly IAutoCountDailySalesService _dailySalesService;

        // Parameterless constructor for Web API default activator
        public DailySalesController()
            : this(new AutoCountDailySalesService(AutoCountSessionProvider.Instance))
        {
        }

        public DailySalesController(IAutoCountDailySalesService dailySalesService)
        {
            if (dailySalesService == null)
                throw new ArgumentNullException("dailySalesService");
            _dailySalesService = dailySalesService;
        }

        /// <summary>
        /// POST /api/pos/daily-sales
        /// Submits daily sales data from a POS terminal.
        /// Creates a Cash Book Entry (OR) in AutoCount with the aggregated sales data.
        /// 
        /// Idempotency: Use the same PosReference to prevent duplicate submissions.
        /// If a submission with the same PosReference already exists, returns the existing record.
        /// </summary>
        /// <param name="dailySales">The daily sales data to submit.</param>
        [HttpPost]
        [Route("")]
        public IHttpActionResult SubmitDailySales([FromBody] DailySales dailySales)
        {
            try
            {
                if (dailySales == null)
                    return BadRequest("Daily sales data is required");

                // Validate the submission
                var validation = _dailySalesService.ValidateDailySales(dailySales);
                if (!validation.IsValid)
                {
                    return BadRequest(string.Join("; ", validation.Errors));
                }

                var result = _dailySalesService.SubmitDailySales(dailySales);

                // Check if already synced (idempotent response)
                if (result.Status == "already_synced")
                {
                    return Ok(new
                    {
                        status = "already_synced",
                        message = "This daily sales submission was already processed",
                        autoCountDocNo = result.AutoCountDocNo,
                        data = result
                    });
                }

                // Check if failed
                if (result.Status == "failed")
                {
                    return BadRequest(result.ErrorMessage);
                }

                return Created("api/pos/daily-sales/" + result.AutoCountDocNo, new
                {
                    status = "synced",
                    message = "Daily sales submitted successfully to AutoCount",
                    autoCountDocNo = result.AutoCountDocNo,
                    data = result
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/pos/daily-sales/{docNo}
        /// Retrieves a previously submitted daily sales record by AutoCount document number.
        /// </summary>
        /// <param name="docNo">The AutoCount Cash Book Entry document number.</param>
        [HttpGet]
        [Route("{docNo}")]
        public IHttpActionResult GetDailySales(string docNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(docNo))
                    return BadRequest("Document number is required");

                var dailySales = _dailySalesService.GetDailySalesByDocNo(docNo);
                if (dailySales == null)
                    return NotFound();

                return Ok(dailySales);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/pos/daily-sales/by-reference/{posReference}
        /// Retrieves a previously submitted daily sales record by POS reference.
        /// Useful for checking if a submission was already processed.
        /// </summary>
        /// <param name="posReference">The POS-generated reference number.</param>
        [HttpGet]
        [Route("by-reference/{posReference}")]
        public IHttpActionResult GetDailySalesByReference(string posReference)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(posReference))
                    return BadRequest("POS reference is required");

                var dailySales = _dailySalesService.GetDailySalesByPosReference(posReference);
                if (dailySales == null)
                    return NotFound();

                return Ok(dailySales);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /api/pos/daily-sales/validate
        /// Validates daily sales data without submitting.
        /// Use this to check for errors before actual submission.
        /// </summary>
        /// <param name="dailySales">The daily sales data to validate.</param>
        [HttpPost]
        [Route("validate")]
        public IHttpActionResult ValidateDailySales([FromBody] DailySales dailySales)
        {
            try
            {
                if (dailySales == null)
                    return BadRequest("Daily sales data is required");

                var validation = _dailySalesService.ValidateDailySales(dailySales);
                return Ok(new
                {
                    isValid = validation.IsValid,
                    errors = validation.Errors,
                    warnings = validation.Warnings
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}

