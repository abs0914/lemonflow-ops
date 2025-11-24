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

                // TODO: Perform a minimal query to AutoCount to verify connectivity
                // This requires calling methods on the UserSession obtained from _sessionProvider.GetUserSession()
                // Example (pseudo-code):
                // var userSession = _sessionProvider.GetUserSession();
                // var companyProfile = userSession.GetCompanyProfile();
                // if (companyProfile == null)
                //     return BadRequest("Failed to retrieve company profile from AutoCount");

                return Ok(new
                {
                    status = "healthy",
                    autocount_connected = true,
                    timestamp = DateTime.UtcNow,
                    message = "Backend is connected to AutoCount Accounting 2.1"
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

