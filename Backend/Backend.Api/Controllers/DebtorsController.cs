using System;
using System.Collections.Generic;
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
    /// </summary>
    [RoutePrefix("api/debtors")]
    public class DebtorsController : ApiController
    {
        private readonly IAutoCountDebtorService _debtorService;

        public DebtorsController(IAutoCountDebtorService debtorService)
        {
            if (debtorService == null)
                throw new ArgumentNullException("debtorService");
            _debtorService = debtorService;
        }

        /// <summary>
        /// GET /api/debtors
        /// Retrieves all debtors from AutoCount.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAllDebtors()
        {
            try
            {
                var debtors = _debtorService.GetAllDebtors();
                return Ok(debtors);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/debtors/{code}
        /// Retrieves a specific debtor by code.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        [HttpGet]
        [Route("{code}")]
        public IHttpActionResult GetDebtorByCode(string code)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(code))
                    return BadRequest("Debtor code is required");

                var debtor = _debtorService.GetDebtorByCode(code);
                if (debtor == null)
                    return NotFound();

                return Ok(debtor);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// POST /api/debtors
        /// Creates a new debtor in AutoCount.
        /// </summary>
        /// <param name="debtor">The debtor to create.</param>
        [HttpPost]
        [Route("")]
        public IHttpActionResult CreateDebtor([FromBody] Debtor debtor)
        {
            try
            {
                if (debtor == null)
                    return BadRequest("Debtor data is required");

                if (string.IsNullOrWhiteSpace(debtor.Code))
                    return BadRequest("Debtor code is required");

                if (string.IsNullOrWhiteSpace(debtor.Name))
                    return BadRequest("Debtor name is required");

                var createdDebtor = _debtorService.CreateDebtor(debtor);
                return Created("api/debtors/" + createdDebtor.Code, createdDebtor);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// PUT /api/debtors/{code}
        /// Updates an existing debtor in AutoCount.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        /// <param name="debtor">The updated debtor data.</param>
        [HttpPut]
        [Route("{code}")]
        public IHttpActionResult UpdateDebtor(string code, [FromBody] Debtor debtor)
        {
            try
            {
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
        /// DELETE /api/debtors/{code}
        /// Deletes a debtor from AutoCount.
        /// </summary>
        /// <param name="code">The debtor code.</param>
        [HttpDelete]
        [Route("{code}")]
        public IHttpActionResult DeleteDebtor(string code)
        {
            try
            {
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
    }
}

