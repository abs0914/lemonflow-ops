using System;
using System.Net;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// HTTP API controller exposing AutoCount Purchase Orders for the
    /// Supabase sync-po-create and sync-po-cancel functions.
    ///
    /// Route shapes are aligned with Supabase expectations:
    ///   - POST /api/purchase/create  (Authorization: Basic ...)
    ///   - POST /api/purchase/cancel  (Authorization: Basic ...)
    ///
    /// Both endpoints validate credentials against BasicAuthConfig and
    /// delegate to IAutoCountPurchaseOrderService.
    /// </summary>
    [RoutePrefix("api/purchase")]
    public class PurchaseOrdersController : ApiController
    {
        private readonly IAutoCountPurchaseOrderService _purchaseOrderService;
        private readonly BasicAuthHelper _basicAuthHelper;

        // Parameterless constructor for Web API default activator.
        public PurchaseOrdersController()
            : this(
                new AutoCountPurchaseOrderService(AutoCountSessionProvider.Instance),
                new BasicAuthHelper(BasicAuthConfig.LoadFromConfig()))
        {
        }

        public PurchaseOrdersController(
            IAutoCountPurchaseOrderService purchaseOrderService,
            BasicAuthHelper basicAuthHelper)
        {
            if (purchaseOrderService == null)
                throw new ArgumentNullException("purchaseOrderService");
            if (basicAuthHelper == null)
                throw new ArgumentNullException("basicAuthHelper");

            _purchaseOrderService = purchaseOrderService;
            _basicAuthHelper = basicAuthHelper;
        }

        /// <summary>
        /// Supabase-compatible endpoint to create a purchase order in AutoCount.
        ///
        /// Called by sync-po-create as:
        ///   POST /api/purchase/create
        ///   Authorization: Basic base64(username:password)
        ///   Body: {
        ///     "DocNo": "PO0001",
        ///     "SupplierCode": "SUP001",
        ///     "DocDate": "2025-01-01",
        ///     "DeliveryDate": "2025-01-02",
        ///     "Description": "...",
        ///     "Details": [ { ... } ]
        ///   }
        /// </summary>
        [HttpPost]
        [Route("create")]
        public IHttpActionResult CreatePurchaseOrder([FromBody] PurchaseOrder request)
        {
            try
            {
                string username;
                IHttpActionResult authError;
                if (!TryAuthorizeBasicRequest(out username, out authError))
                    return authError;

                if (request == null)
                    return BadRequest("Request body is required");

                if (string.IsNullOrWhiteSpace(request.SupplierCode))
                    return BadRequest("SupplierCode is required");

                if (request.Details == null || request.Details.Count == 0)
                    return BadRequest("At least one detail line is required");

                if (request.DocDate == default(DateTime))
                    request.DocDate = DateTime.Today;

                if (!request.DeliveryDate.HasValue)
                    request.DeliveryDate = request.DocDate;

                var created = _purchaseOrderService.CreatePurchaseOrder(request);

                return Ok(new
                {
                    success = true,
                    docNo = created.DocNo,
                    createdBy = username
                });
            }
            catch (InvalidOperationException ex)
            {
                return Content(HttpStatusCode.BadRequest, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        private class CancelPurchaseOrderRequest
        {
            public string DocNo { get; set; }
        }

        /// <summary>
        /// Supabase-compatible endpoint to cancel a purchase order in AutoCount.
        ///
        /// Called by sync-po-cancel as:
        ///   POST /api/purchase/cancel
        ///   Authorization: Basic base64(username:password)
        ///   Body: { "DocNo": "PO0001" }
        /// </summary>
        [HttpPost]
        [Route("cancel")]
        public IHttpActionResult CancelPurchaseOrder([FromBody] CancelPurchaseOrderRequest request)
        {
            try
            {
                string username;
                IHttpActionResult authError;
                if (!TryAuthorizeBasicRequest(out username, out authError))
                    return authError;

                if (request == null || string.IsNullOrWhiteSpace(request.DocNo))
                    return BadRequest("DocNo is required");

                bool cancelled = _purchaseOrderService.CancelPurchaseOrder(request.DocNo);
                if (!cancelled)
                    return NotFound();

                return Ok(new
                {
                    success = true,
                    docNo = request.DocNo,
                    cancelledBy = username
                });
            }
            catch (InvalidOperationException ex)
            {
                return Content(HttpStatusCode.BadRequest, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// Validates HTTP Basic authentication against configured Lemon-co
        /// API credentials.
        /// </summary>
        private bool TryAuthorizeBasicRequest(out string username, out IHttpActionResult errorResult)
        {
            username = null;
            errorResult = null;

            var authHeader = Request?.Headers?.Authorization;
            if (authHeader == null ||
                !authHeader.Scheme.Equals("Basic", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(authHeader.Parameter))
            {
                errorResult = Unauthorized();
                return false;
            }

            string errorMessage;
            if (!_basicAuthHelper.TryValidateCredentials(authHeader.Parameter, out username, out errorMessage))
            {
                errorResult = Unauthorized();
                return false;
            }

            return true;
        }
    }
}
