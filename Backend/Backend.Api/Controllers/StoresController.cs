using System;
using System.Web.Http;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// REST API controller for Store master data operations.
    /// 
    /// Provides endpoints to retrieve store information for:
    /// - Dashboard store filters
    /// - Store selection dropdowns
    /// - Store validation
    /// 
    /// Stores are classified as:
    /// - "own" - Company-owned stores (code starts with STORE-)
    /// - "franchise" - Franchise locations (code starts with FRANCHISE-)
    /// </summary>
    [RoutePrefix("api/stores")]
    public class StoresController : ApiController
    {
        private readonly IAutoCountStoreService _storeService;

        // Parameterless constructor for Web API default activator
        public StoresController()
            : this(new AutoCountStoreService(AutoCountSessionProvider.Instance))
        {
        }

        public StoresController(IAutoCountStoreService storeService)
        {
            if (storeService == null)
                throw new ArgumentNullException("storeService");
            _storeService = storeService;
        }

        /// <summary>
        /// GET /api/stores
        /// Retrieves all stores with optional type filtering.
        /// </summary>
        /// <param name="type">Optional filter: "own" for owned stores, "franchise" for franchise locations.</param>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetStores([FromUri] string type = null)
        {
            try
            {
                var stores = string.IsNullOrWhiteSpace(type)
                    ? _storeService.GetAllStores()
                    : _storeService.GetStoresByType(type);

                return Ok(new
                {
                    count = stores.Count,
                    type = type,
                    data = stores
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/stores/{storeCode}
        /// Retrieves a specific store by code.
        /// </summary>
        /// <param name="storeCode">The store code (e.g., "STORE-SM-001").</param>
        [HttpGet]
        [Route("{storeCode}")]
        public IHttpActionResult GetStore(string storeCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(storeCode))
                    return BadRequest("Store code is required");

                var store = _storeService.GetStoreByCode(storeCode);
                if (store == null)
                    return NotFound();

                return Ok(store);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// GET /api/stores/{storeCode}/exists
        /// Checks if a store exists.
        /// </summary>
        /// <param name="storeCode">The store code to check.</param>
        [HttpGet]
        [Route("{storeCode}/exists")]
        public IHttpActionResult StoreExists(string storeCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(storeCode))
                    return BadRequest("Store code is required");

                bool exists = _storeService.StoreExists(storeCode);
                return Ok(new { storeCode = storeCode, exists = exists });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}

