using System;
using System.Net;
using System.Security.Claims;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// HTTP API controller exposing AutoCount stock adjustments for the
    /// Supabase sync-stock-adjustment function.
    ///
    /// Route shape is aligned with Supabase expectations:
    ///   - POST /stock-adjustments  (Authorization: Bearer &lt;jwt&gt;)
    ///
    /// The controller validates the JWT using JwtAuthenticationHelper
    /// and delegates to IAutoCountStockAdjustmentService.
    /// </summary>
    [RoutePrefix("stock-adjustments")]
    public class StockAdjustmentsController : ApiController
    {
        private readonly IAutoCountStockAdjustmentService _adjustmentService;
        private readonly JwtAuthenticationHelper _jwtHelper;

        // Parameterless constructor for Web API default activator.
        public StockAdjustmentsController()
            : this(
                new AutoCountStockAdjustmentService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()))
        {
        }

        public StockAdjustmentsController(
            IAutoCountStockAdjustmentService adjustmentService,
            JwtAuthenticationHelper jwtHelper)
        {
            if (adjustmentService == null)
                throw new ArgumentNullException("adjustmentService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");

            _adjustmentService = adjustmentService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// POST /stock-adjustments
        /// Creates a new stock adjustment document in AutoCount.
        ///
        /// Supabase sends a PascalCase payload that maps to StockAdjustment:
        ///   {
        ///     "ItemCode": "ITEM001",
        ///     "Location": "HQ",
        ///     "AdjustmentType": "IN" | "OUT" | "SET",
        ///     "Quantity": 5,
        ///     "UOM": "unit",
        ///     "Description": "Manual adjustment",
        ///     "BatchNumber": null,
        ///     "Reason": "Manual Adjustment",
        ///     "DocDate": "2025-01-01"
        ///   }
        /// </summary>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateStockAdjustment([FromBody] StockAdjustment request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (request == null)
                    return BadRequest("Request body is required");

                if (string.IsNullOrWhiteSpace(request.ItemCode))
                    return BadRequest("ItemCode is required");

                if (request.Quantity == 0)
                    return BadRequest("Quantity must not be zero");

                if (string.IsNullOrWhiteSpace(request.AdjustmentType))
                    request.AdjustmentType = "IN";

                var type = request.AdjustmentType.ToUpperInvariant();
                if (type != "IN" && type != "OUT" && type != "SET")
                    return BadRequest("AdjustmentType must be IN, OUT or SET");

                // Default reason and date when omitted (keeps behaviour close to Supabase function).
                if (string.IsNullOrWhiteSpace(request.Reason))
                    request.Reason = "Manual Adjustment";

                if (!request.DocDate.HasValue)
                    request.DocDate = DateTime.Today;

                var docNo = _adjustmentService.CreateStockAdjustment(request);

                return Ok(new
                {
                    success = true,
                    docNo = docNo,
                    itemCode = request.ItemCode,
                    adjustmentType = type,
                    quantity = request.Quantity
                });
            }
            catch (InvalidOperationException ex)
            {
                // Attempt to surface "item not found" style errors as 404 so
                // Supabase can present a user-friendly message.
                var text = ex.ToString().ToLowerInvariant();
                if (text.Contains("item not found") ||
                    text.Contains("item does not exist") ||
                    text.Contains("invalid itemcode"))
                {
                    return Content(HttpStatusCode.NotFound, new
                    {
                        message = ex.Message
                    });
                }

                return Content(HttpStatusCode.BadRequest, new
                {
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// Extracts and validates the Bearer token from the Authorization
        /// header using JwtAuthenticationHelper.
        /// </summary>
        private bool TryAuthorizeRequest(out ClaimsPrincipal principal, out IHttpActionResult errorResult)
        {
            principal = null;
            errorResult = null;

            var authHeader = Request?.Headers?.Authorization;
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
