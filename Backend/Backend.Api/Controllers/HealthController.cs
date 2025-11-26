using System;
using System.Web.Http;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api.Controllers
{
    /// <summary>
    /// Health check endpoints for the backend service.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// 
    /// These endpoints verify that:
    /// 1. The backend service is running and responsive.
    /// 2. The AutoCount connection is properly initialized and functional.
    /// </summary>
    [RoutePrefix("api/health")]
    public class HealthController : ApiController
    {
        private readonly IAutoCountSessionProvider _sessionProvider;

	        public HealthController()
	            : this(AutoCountSessionProvider.Instance)
	        {
	        }

	        public HealthController(IAutoCountSessionProvider sessionProvider)
	        {
	            if (sessionProvider == null)
	                throw new ArgumentNullException("sessionProvider");
	            _sessionProvider = sessionProvider;
	        }

        /// <summary>
        /// Basic health check endpoint.
        /// Returns 200 OK if the service is running.
        /// </summary>
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetHealth()
        {
            try
            {
                return Ok(new
                {
                    status = "healthy",
                    timestamp = DateTime.UtcNow,
                    version = "1.0.0"
                });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        /// <summary>
        /// AutoCount-specific health check endpoint.
        /// Verifies that the backend can connect to and query AutoCount.
        /// 
        /// Per AutoCount docs: "Initiate UserSession and DBSetting"
        /// https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting
        /// </summary>
        [HttpGet]
        [Route("autocount")]
        public IHttpActionResult GetAutoCountHealth()
        {
            try
            {
                if (!_sessionProvider.IsInitialized)
                {
                    return BadRequest("AutoCount session not initialized: " + _sessionProvider.InitializationError);
                }

	                // Perform a very lightweight AutoCount query to verify connectivity.
	                // Per docs, DBRegistry.LocalCurrencyCode is safe and does not modify data.
	                var dbSetting = _sessionProvider.GetDBSetting();
	                if (dbSetting == null)
	                {
	                    return Ok(new
	                    {
	                        status = "degraded",
	                        autocount_connected = false,
	                        timestamp = DateTime.UtcNow,
	                        message = "AutoCount session reports initialized but DBSetting is null."
	                    });
	                }

                string localCurrency = global::AutoCount.Data.DBRegistry.Create(dbSetting)
                    .GetString(new global::AutoCount.RegistryID.LocalCurrencyCode());
	                bool connected = !string.IsNullOrEmpty(localCurrency);

	                return Ok(new
	                {
	                    status = connected ? "healthy" : "degraded",
	                    autocount_connected = connected,
	                    local_currency = localCurrency,
	                    timestamp = DateTime.UtcNow
	                });
            }
            catch (Exception ex)
            {
                return InternalServerError(new InvalidOperationException(
                    "AutoCount health check failed: " + ex.Message, ex));
            }
        }
    }
}

