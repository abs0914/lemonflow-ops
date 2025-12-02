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
    /// REST API controller for Debtor (Customer) operations.
    ///
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    ///
    /// This controller implements the "Interface with API – Web service" integration method,
    /// exposing endpoints for reading and writing master data (Debtors) to AutoCount.
    ///
    /// Routes:
    ///   GET  /autocount/debtors          - List all debtors (JWT required)
    ///   GET  /autocount/debtors/{code}   - Get a specific debtor (JWT required)
    ///   POST /autocount/debtors          - Create a debtor (JWT required)
    ///   PUT  /autocount/debtors/{code}   - Update a debtor (JWT required)
    ///   DELETE /autocount/debtors/{code} - Delete a debtor (JWT required)
    /// </summary>
    [RoutePrefix("autocount/debtors")]
    public class DebtorsController : ApiController
    {
        private readonly IAutoCountDebtorService _debtorService;
        private readonly JwtAuthenticationHelper _jwtHelper;

        // Parameterless constructor for Web API default activator
        public DebtorsController()
            : this(
                new AutoCountDebtorService(AutoCountSessionProvider.Instance),
                new JwtAuthenticationHelper(JwtConfig.LoadFromConfig()))
        {
        }

        public DebtorsController(IAutoCountDebtorService debtorService, JwtAuthenticationHelper jwtHelper)
        {
            if (debtorService == null)
                throw new ArgumentNullException("debtorService");
            if (jwtHelper == null)
                throw new ArgumentNullException("jwtHelper");
            _debtorService = debtorService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// GET /autocount/debtors
        /// Retrieves all debtors from AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAllDebtors([FromUri] int? limit = null)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                var debtors = _debtorService.GetAllDebtors() ?? new List<Debtor>();

                // Apply limit if specified
                if (limit.HasValue && limit.Value > 0)
                {
                    debtors = debtors.Take(limit.Value).ToList();
                }

                // Return camelCase shape for consistency with other endpoints
                var result = debtors.Select(d => new
                {
                    code = d.Code,
                    name = d.Name,
                    contactPerson = d.ContactPerson,
                    email = d.Email,
                    phone = d.Phone,
                    address1 = d.Address1,
                    address2 = d.Address2,
                    city = d.City,
                    state = d.State,
                    postalCode = d.PostalCode,
                    country = d.Country,
                    creditLimit = d.CreditLimit,
                    currencyCode = d.CurrencyCode,
                    isActive = d.IsActive
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /autocount/debtors/{code}
        /// Retrieves a specific debtor by code.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        [HttpGet]
        [Route("{code}")]
        public IHttpActionResult GetDebtorByCode(string code)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Debtor code is required");

                var debtor = _debtorService.GetDebtorByCode(code);
                if (debtor == null)
                    return NotFound();

                // Return camelCase shape for consistency
                var result = new
                {
                    code = debtor.Code,
                    name = debtor.Name,
                    contactPerson = debtor.ContactPerson,
                    email = debtor.Email,
                    phone = debtor.Phone,
                    address1 = debtor.Address1,
                    address2 = debtor.Address2,
                    city = debtor.City,
                    state = debtor.State,
                    postalCode = debtor.PostalCode,
                    country = debtor.Country,
                    creditLimit = debtor.CreditLimit,
                    currencyCode = debtor.CurrencyCode,
                    isActive = debtor.IsActive
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /autocount/debtors
        /// Creates a new debtor in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        /// <param name="debtor">The debtor to create.</param>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateDebtor([FromBody] Debtor debtor)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (debtor == null)
                    return BadRequest("Debtor data is required");

                if (string.IsNullOrWhiteSpace(debtor.Code))
                    return BadRequest("Debtor code is required");

                if (string.IsNullOrWhiteSpace(debtor.Name))
                    return BadRequest("Debtor name is required");

                var createdDebtor = _debtorService.CreateDebtor(debtor);
                return Created("autocount/debtors/" + createdDebtor.Code, createdDebtor);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// PUT /autocount/debtors/{code}
        /// Updates an existing debtor in AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        /// <param name="debtor">The updated debtor data.</param>
        [HttpPut]
        [Route("{code}")]
        public IHttpActionResult UpdateDebtor(string code, [FromBody] Debtor debtor)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Debtor code is required");

                if (debtor == null)
                    return BadRequest("Debtor data is required");

                if (debtor.Code != code)
                    return BadRequest("Debtor code in URL does not match body");

                var updatedDebtor = _debtorService.UpdateDebtor(debtor);
                return Ok(updatedDebtor);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// DELETE /autocount/debtors/{code}
        /// Deletes a debtor from AutoCount.
        /// Requires a valid Bearer JWT in the Authorization header.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        [HttpDelete]
        [Route("{code}")]
        public IHttpActionResult DeleteDebtor(string code)
        {
            try
            {
                ClaimsPrincipal principal;
                IHttpActionResult authError;
                if (!TryAuthorizeRequest(out principal, out authError))
                    return authError;

                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Debtor code is required");

                if (!_debtorService.DebtorExists(code))
                    return NotFound();

                _debtorService.DeleteDebtor(code);
                return StatusCode(System.Net.HttpStatusCode.NoContent);
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

