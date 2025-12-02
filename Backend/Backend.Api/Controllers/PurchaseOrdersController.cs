using System;
using System.Net;
using System.Security.Claims;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// HTTP API controller exposing AutoCount Purchase Orders.
    ///
    /// Route shapes:
    ///   - POST /autocount/purchase-orders        (Authorization: Bearer jwt)
    ///   - POST /autocount/purchase-orders/cancel (Authorization: Bearer jwt)
    ///
    /// Both endpoints validate JWT using JwtAuthenticationHelper and
    /// delegate to IAutoCountPurchaseOrderService.
    /// </summary>
    [RoutePrefix("autocount/purchase-orders")]
    public class PurchaseOrdersController : ApiController
    {
        private readonly IAutoCountPurchaseOrderService _purchaseOrderService;
        private readonly JwtAuthenticationHelper _jwtHelper;

        // Parameterless constructor for Web API default activator.
        public PurchaseOrdersController()
            : this(
                new AutoCountPurchaseOrderService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()))
        {
        }

        public PurchaseOrdersController(
            IAutoCountPurchaseOrderService purchaseOrderService,
            JwtAuthenticationHelper jwtHelper)
        {
            if (purchaseOrderService == null)
                throw new ArgumentNullException("purchaseOrderService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");

            _purchaseOrderService = purchaseOrderService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// GET /autocount/purchase-orders
        /// Returns a list of purchase orders from AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetPurchaseOrders([FromUri] int? limit = null)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                var purchaseOrders = _purchaseOrderService.GetPurchaseOrders(limit);
                return Ok(purchaseOrders);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /autocount/purchase-orders/{docNo}
        /// Returns a single purchase order by document number.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpGet]
        [Route("{docNo}")]
        public IHttpActionResult GetPurchaseOrder(string docNo)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(docNo))
                    return BadRequest("Document number is required");

                var purchaseOrder = _purchaseOrderService.GetPurchaseOrder(docNo);
                if (purchaseOrder == null)
                    return NotFound();

                return Ok(purchaseOrder);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /autocount/purchase-orders
        /// Creates a purchase order in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreatePurchaseOrder([FromBody] PurchaseOrder request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
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
                    docNo = created.DocNo
                });
            }
            catch (InvalidOperationException ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : null;
                var innerStack = ex.InnerException != null ? ex.InnerException.StackTrace : null;
                return Content(HttpStatusCode.BadRequest, new {
                    message = ex.Message,
                    innerError = innerMessage,
                    stackTrace = ex.StackTrace,
                    innerStackTrace = innerStack
                });
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : null;
                var innerStack = ex.InnerException != null ? ex.InnerException.StackTrace : null;
                return Content(HttpStatusCode.InternalServerError, new {
                    message = ex.Message,
                    innerError = innerMessage,
                    stackTrace = ex.StackTrace,
                    innerStackTrace = innerStack
                });
            }
        }

        public class CancelPurchaseOrderRequest
        {
            public string DocNo { get; set; }
        }

        /// <summary>
        /// POST /autocount/purchase-orders/cancel
        /// Cancels a purchase order in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpPost]
        [Route("cancel")]
        public IHttpActionResult CancelPurchaseOrder([FromBody] CancelPurchaseOrderRequest request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (request == null || string.IsNullOrWhiteSpace(request.DocNo))
                    return BadRequest("DocNo is required");

                bool cancelled = _purchaseOrderService.CancelPurchaseOrder(request.DocNo);
                if (!cancelled)
                    return NotFound();

                return Ok(new
                {
                    success = true,
                    docNo = request.DocNo
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
        /// Validates Bearer JWT token from Authorization header.
        /// </summary>
        private bool TryAuthorizeRequest(out ClaimsPrincipal principal, out IHttpActionResult errorResult)
        {
            principal = null;
            errorResult = null;

            var authHeader = Request != null && Request.Headers != null ? Request.Headers.Authorization : null;
            if (authHeader == null ||
                !authHeader.Scheme.Equals("Bearer", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(authHeader.Parameter))
            {
                errorResult = Unauthorized();
                return false;
            }

            ClaimsPrincipal claims;
            if (!_jwtHelper.ValidateToken(authHeader.Parameter, out claims))
            {
                errorResult = Unauthorized();
                return false;
            }

            principal = claims;
            return true;
        }
    }
}
