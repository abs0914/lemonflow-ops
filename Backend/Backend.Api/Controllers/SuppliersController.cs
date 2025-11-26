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
    /// HTTP API controller exposing AutoCount suppliers (creditors) for Supabase sync.
    ///
    /// Route shape is aligned with Supabase Edge function expectations:
    ///   - GET /autocount/suppliers  (Authorization: Bearer &lt;jwt&gt;)
    ///
    /// The controller validates the JWT using JwtAuthenticationHelper and then
    /// delegates to IAutoCountSupplierService for data retrieval.
    /// </summary>
    [RoutePrefix("autocount/suppliers")]
    public class SuppliersController : ApiController
    {
        private readonly IAutoCountSupplierService _supplierService;
        private readonly JwtAuthenticationHelper _jwtHelper;

        // Parameterless constructor for Web API default activator
        public SuppliersController()
            : this(
                new AutoCountSupplierService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()))
        {
        }

        public SuppliersController(IAutoCountSupplierService supplierService, JwtAuthenticationHelper jwtHelper)
        {
            if (supplierService == null)
                throw new ArgumentNullException("supplierService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");

            _supplierService = supplierService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// GET /autocount/suppliers
        /// Returns the list of suppliers from AutoCount for synchronization.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetSuppliers()
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                var suppliers = _supplierService.GetAllSuppliers() ?? new List<Supplier>();

                // Project to the shape expected by Supabase Edge functions
                var result = suppliers.Select(s => new
                {
                    code = s.Code,
                    companyName = s.CompanyName,
                    contactPerson = s.ContactPerson,
                    phone = s.Phone,
                    email = s.Email,
                    address = s.Address,
                    creditTerms = s.CreditTerms,
                    isActive = s.IsActive
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// Extracts and validates the Bearer token from the Authorization header.
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

