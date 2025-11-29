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
    /// Route shapes:
    ///   - GET  /autocount/suppliers       (Authorization: Bearer jwt)
    ///   - POST /autocount/suppliers       (Authorization: Bearer jwt)
    ///   - PUT  /autocount/suppliers/{code} (Authorization: Bearer jwt)
    ///
    /// The controller validates the JWT using JwtAuthenticationHelper and then
    /// delegates to IAutoCountSupplierService for data operations.
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
        /// POST /autocount/suppliers
        /// Creates a new supplier in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateSupplier([FromBody] SupplierCreateRequest request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (request == null || string.IsNullOrWhiteSpace(request.Code))
                    return BadRequest("Supplier code is required.");

                var supplier = new Supplier
                {
                    Code = request.Code,
                    CompanyName = request.CompanyName ?? "",
                    ContactPerson = request.ContactPerson ?? "",
                    Phone = request.Phone ?? "",
                    Email = request.Email ?? "",
                    Address = request.Address ?? "",
                    CreditTerms = request.CreditTerms,
                    IsActive = request.IsActive
                };

                var created = _supplierService.CreateSupplier(supplier);

                return Ok(new
                {
                    code = created.Code,
                    companyName = created.CompanyName,
                    contactPerson = created.ContactPerson,
                    phone = created.Phone,
                    email = created.Email,
                    address = created.Address,
                    creditTerms = created.CreditTerms,
                    isActive = created.IsActive
                });
            }
            catch (InvalidOperationException ex)
            {
                if (ex.Message.Contains("already exists"))
                    return Conflict();
                return InternalServerError(ex);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// PUT /autocount/suppliers/{code}
        /// Updates an existing supplier in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpPut]
        [Route("{code}")]
        public IHttpActionResult UpdateSupplier(string code, [FromBody] SupplierUpdateRequest request)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Supplier code is required.");

                if (!_supplierService.SupplierExists(code))
                    return NotFound();

                var supplier = new Supplier
                {
                    Code = code,
                    CompanyName = request != null ? request.CompanyName : null,
                    ContactPerson = request != null ? request.ContactPerson : null,
                    Phone = request != null ? request.Phone : null,
                    Email = request != null ? request.Email : null,
                    Address = request != null ? request.Address : null,
                    CreditTerms = request != null ? request.CreditTerms : null,
                    IsActive = request != null ? request.IsActive : true
                };

                var updated = _supplierService.UpdateSupplier(supplier);

                return Ok(new
                {
                    code = updated.Code,
                    companyName = updated.CompanyName,
                    contactPerson = updated.ContactPerson,
                    phone = updated.Phone,
                    email = updated.Email,
                    address = updated.Address,
                    creditTerms = updated.CreditTerms,
                    isActive = updated.IsActive
                });
            }
            catch (InvalidOperationException ex)
            {
                if (ex.Message.Contains("not found"))
                    return NotFound();
                return InternalServerError(ex);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// DELETE /autocount/suppliers/{code}
        /// Deletes (deactivates) a supplier in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpDelete]
        [Route("{code}")]
        public IHttpActionResult DeleteSupplier(string code)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Supplier code is required.");

                var deleted = _supplierService.DeleteSupplier(code);

                if (!deleted)
                    return NotFound();

                return Ok(new { message = "Supplier '" + code + "' has been deactivated.", code = code });
            }
            catch (InvalidOperationException ex)
            {
                return InternalServerError(ex);
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

    /// <summary>
    /// Request model for creating a supplier.
    /// </summary>
    public class SupplierCreateRequest
    {
        public string Code { get; set; }
        public string CompanyName { get; set; }
        public string ContactPerson { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Address { get; set; }
        public int? CreditTerms { get; set; }
        public bool IsActive { get; set; }
    }

    /// <summary>
    /// Request model for updating a supplier.
    /// </summary>
    public class SupplierUpdateRequest
    {
        public string CompanyName { get; set; }
        public string ContactPerson { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Address { get; set; }
        public int? CreditTerms { get; set; }
        public bool IsActive { get; set; }
    }
}

