using System;
using System.Net;
using System.Security.Claims;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// HTTP API controller exposing AutoCount Sales Orders.
    /// Used for Franchisee/Own Store order management.
    ///
    /// Route shapes:
    ///   - GET  /autocount/sales-orders              (list all)
    ///   - GET  /autocount/sales-orders/{docNo}      (get single)
    ///   - POST /autocount/sales-orders              (create)
    ///   - POST /autocount/sales-orders/cancel       (cancel)
    ///
    /// All endpoints require Bearer JWT authorization.
    /// </summary>
    [RoutePrefix("autocount/sales-orders")]
    public class SalesOrdersController : ApiController
    {
        private readonly IAutoCountSalesOrderService _salesOrderService;
        private readonly JwtAuthenticationHelper _jwtHelper;

        // Parameterless constructor for Web API default activator.
        public SalesOrdersController()
            : this(
                new AutoCountSalesOrderService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()))
        {
        }

        public SalesOrdersController(
            IAutoCountSalesOrderService salesOrderService,
            JwtAuthenticationHelper jwtHelper)
        {
            if (salesOrderService == null)
                throw new ArgumentNullException("salesOrderService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");

            _salesOrderService = salesOrderService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// GET /autocount/sales-orders
        /// Returns a list of sales orders from AutoCount.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetSalesOrders([FromUri] int? limit = null)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                var salesOrders = _salesOrderService.GetSalesOrders(limit);
                return Ok(salesOrders);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /autocount/sales-orders/{docNo}
        /// Returns a single sales order by document number with line details.
        /// </summary>
        [HttpGet]
        [Route("{docNo}")]
        public IHttpActionResult GetSalesOrder(string docNo)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(docNo))
                    return BadRequest("Document number is required");

                var salesOrder = _salesOrderService.GetSalesOrderByDocNo(docNo);
                if (salesOrder == null)
                    return NotFound();

                return Ok(salesOrder);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /autocount/sales-orders
        /// Creates a sales order in AutoCount.
        /// </summary>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateSalesOrder([FromBody] SalesOrder request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (request == null)
                    return BadRequest("Request body is required");

                if (string.IsNullOrWhiteSpace(request.DebtorCode))
                    return BadRequest("DebtorCode is required");

                if (request.Lines == null || request.Lines.Count == 0)
                    return BadRequest("At least one line item is required");

                if (request.DocDate == default(DateTime))
                    request.DocDate = DateTime.Today;

                var created = _salesOrderService.CreateSalesOrder(request);

                return Ok(new
                {
                    success = true,
                    docNo = created.DocNo
                });
            }
            catch (InvalidOperationException ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : null;
                return Content(HttpStatusCode.BadRequest, new
                {
                    message = ex.Message,
                    innerError = innerMessage
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        public class CancelSalesOrderRequest
        {
            public string DocNo { get; set; }
        }

        /// <summary>
        /// POST /autocount/sales-orders/cancel
        /// Cancels a sales order in AutoCount.
        /// </summary>
        [HttpPost]
        [Route("cancel")]
        public IHttpActionResult CancelSalesOrder([FromBody] CancelSalesOrderRequest request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (request == null || string.IsNullOrWhiteSpace(request.DocNo))
                    return BadRequest("DocNo is required");

                bool cancelled = _salesOrderService.CancelSalesOrder(request.DocNo);
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
