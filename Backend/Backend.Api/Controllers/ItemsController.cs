using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Web.Http;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// HTTP API controller exposing AutoCount stock items for Supabase sync and
    /// maintenance.
    ///
    /// Routes are aligned with Supabase Edge function expectations:
    ///   - GET  /autocount/items       (Authorization: Bearer jwt)
    ///   - POST /autocount/items       (Authorization: Bearer jwt)
    ///   - PUT  /api/stock/update-item (Authorization: Basic ...)
    /// </summary>
    [RoutePrefix("autocount/items")]
    public class ItemsController : ApiController
    {
        private readonly IAutoCountItemService _itemService;
        private readonly JwtAuthenticationHelper _jwtHelper;
        private readonly BasicAuthHelper _basicAuthHelper;

        // Parameterless constructor for Web API default activator
        public ItemsController()
            : this(
                new AutoCountItemService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()),
                new BasicAuthHelper(BasicAuthConfig.LoadFromConfig()))
        {
        }

        public ItemsController(
            IAutoCountItemService itemService,
            JwtAuthenticationHelper jwtHelper,
            BasicAuthHelper basicAuthHelper)
        {
            if (itemService == null)
                throw new ArgumentNullException("itemService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");
            if (basicAuthHelper == null)
                throw new ArgumentNullException("basicAuthHelper");

            _itemService = itemService;
            _jwtHelper = jwtHelper;
            _basicAuthHelper = basicAuthHelper;
        }

        /// <summary>
        /// GET /autocount/items
        /// Returns the list of stock items from AutoCount for synchronization.
        /// Requires a valid Bearer JWT in the Authorization header.
        ///
        /// Supabase will call this as:
        ///   GET /autocount/items?limit=1000
        /// and accepts either an array or an object with an "items" or
        /// "data" property. We simply return an array of camelCase objects.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetItems(int? limit = null)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeBearerRequest(out principal, out authError))
                    return authError;

                var items = _itemService.GetItems(limit) ?? new List<StockItem>();

                // Project to the camelCase shape expected by Supabase Edge functions.
                var result = items.Select(i => new
                {
                    itemCode = i.ItemCode,
                    description = i.Description,
                    itemGroup = i.ItemGroup,
                    itemType = i.ItemType,
                    baseUom = i.BaseUom,
                    stockControl = i.StockControl,
                    hasBatchNo = i.HasBatchNo,
                    isActive = i.IsActive,
                    standardCost = i.StandardCost,
                    price = i.Price,
                    stockBalance = i.StockBalance,
                    mainSupplier = i.MainSupplier,
                    barcode = i.Barcode,
                    hasBom = i.HasBom
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /autocount/items
        /// Creates a new stock item in AutoCount.
        ///
        /// Called by the Supabase create-autocount-item function with a
        /// camelCase payload. Model binding is case-insensitive, so it binds
        /// to StockItem automatically.
        /// </summary>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateItem([FromBody] StockItem request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeBearerRequest(out principal, out authError))
                    return authError;

                if (request == null)
                    return BadRequest("Request body is required");

                if (string.IsNullOrWhiteSpace(request.ItemCode))
                    return BadRequest("ItemCode is required");

                if (string.IsNullOrWhiteSpace(request.Description))
                    return BadRequest("Description is required");

                // Ensure some sensible defaults matching Supabase function
                // behaviour when fields are omitted.
                if (string.IsNullOrWhiteSpace(request.BaseUom))
                    request.BaseUom = "unit";

                if (string.IsNullOrWhiteSpace(request.ItemType))
                    request.ItemType = "CONSUMABLE";

                var created = _itemService.CreateItem(request);

                var result = new
                {
                    itemCode = created.ItemCode,
                    description = created.Description,
                    itemGroup = created.ItemGroup,
                    itemType = created.ItemType,
                    baseUom = created.BaseUom,
                    stockControl = created.StockControl,
                    hasBatchNo = created.HasBatchNo,
                    isActive = created.IsActive,
                    standardCost = created.StandardCost,
                    price = created.Price,
                    stockBalance = created.StockBalance,
                    mainSupplier = created.MainSupplier,
                    barcode = created.Barcode,
                    hasBom = created.HasBom
                };

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                // Surface domain-level conflicts (e.g. item already exists) as 409.
                // Include inner exception message for debugging
                var message = ex.Message;
                if (ex.InnerException != null)
                {
                    message += " | Inner: " + ex.InnerException.Message;
                    if (ex.InnerException.InnerException != null)
                    {
                        message += " | Inner2: " + ex.InnerException.InnerException.Message;
                    }
                }
                return Content(System.Net.HttpStatusCode.Conflict, message);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// PUT /api/stock/update-item
        /// Updates an existing stock item in AutoCount.
        ///
        /// This endpoint is called from Supabase with HTTP Basic auth and a
        /// PascalCase JSON payload (ItemCode, Description, BaseUOM, ...).
        /// Model binding is case-insensitive, so it binds to StockItem.
        /// </summary>
        [HttpPut]
        [Route("~/api/stock/update-item")]
        public IHttpActionResult UpdateItem([FromBody] StockItem request)
        {
            try
            {
                string username;
                IHttpActionResult authError;
                if (!TryAuthorizeBasicRequest(out username, out authError))
                    return authError;

                if (request == null)
                    return BadRequest("Request body is required");

                if (string.IsNullOrWhiteSpace(request.ItemCode))
                    return BadRequest("ItemCode is required");

                if (string.IsNullOrWhiteSpace(request.Description))
                    return BadRequest("Description is required");

                if (string.IsNullOrWhiteSpace(request.BaseUom))
                    return BadRequest("BaseUom is required");

                var updated = _itemService.UpdateItem(request);

                var result = new
                {
                    success = true,
                    updatedBy = username,
                    item = new
                    {
                        itemCode = updated.ItemCode,
                        description = updated.Description,
                        itemGroup = updated.ItemGroup,
                        itemType = updated.ItemType,
                        baseUom = updated.BaseUom,
                        stockControl = updated.StockControl,
                        hasBatchNo = updated.HasBatchNo,
                        isActive = updated.IsActive,
                        standardCost = updated.StandardCost,
                        price = updated.Price,
                        stockBalance = updated.StockBalance,
                        mainSupplier = updated.MainSupplier,
                        barcode = updated.Barcode,
                        hasBom = updated.HasBom
                    }
                };

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return Content(System.Net.HttpStatusCode.BadRequest, ex.Message);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// Extracts and validates the Bearer token from the Authorization header.
        /// Reuses the JWT helper from AuthController/SuppliersController.
        /// </summary>
        private bool TryAuthorizeBearerRequest(out ClaimsPrincipal principal, out IHttpActionResult errorResult)
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

        /// <summary>
        /// Validates HTTP Basic authentication against configured Lemon-co API
        /// credentials.
        /// </summary>
        private bool TryAuthorizeBasicRequest(out string username, out IHttpActionResult errorResult)
        {
            username = null;
            errorResult = null;

            var authHeader = Request != null && Request.Headers != null ? Request.Headers.Authorization : null;
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
