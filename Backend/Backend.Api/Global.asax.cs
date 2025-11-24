using System;
using System.Web;
using System.Web.Http;
using Backend.Infrastructure.AutoCount;

namespace Backend.Api
{
    /// <summary>
    /// Global application class for ASP.NET Web API.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting
    /// 
    /// This class handles application startup and initialization of the AutoCount session.
    /// CRITICAL: UserSession must only be initiated once per running application.
    /// This is done in Application_Start.
    /// </summary>
    public class Global : HttpApplication
    {
        protected void Application_Start(object sender, EventArgs e)
        {
            // Register Web API routes
            GlobalConfiguration.Configure(WebApiConfig.Register);

            // Initialize JWT configuration
            InitializeJwtConfiguration();

            // Initialize Supabase configuration
            InitializeSupabaseConfiguration();

            // Initialize AutoCount session
            // Per AutoCount docs: "3 MainEntry to start a subProject"
            // https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#3_MainEntry_to_start_a_subProject
            InitializeAutoCountSession();
        }

        protected void Application_End(object sender, EventArgs e)
        {
            // Cleanup if needed
        }

        protected void Application_Error(object sender, EventArgs e)
        {
            Exception ex = Server.GetLastError();
            if (ex != null)
            {
                System.Diagnostics.Debug.WriteLine("Application error: " + ex.Message);
            }
        }

        /// <summary>
        /// Initializes JWT configuration at application startup.
        /// </summary>
        private void InitializeJwtConfiguration()
        {
            try
            {
                var jwtConfig = JwtConfig.LoadFromConfig();
                if (jwtConfig.IsValid())
                {
                    System.Diagnostics.Debug.WriteLine("JWT configuration initialized successfully");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Failed to initialize JWT configuration: " + ex.Message);
                throw;
            }
        }

        /// <summary>
        /// Initializes Supabase configuration at application startup.
        /// </summary>
        private void InitializeSupabaseConfiguration()
        {
            try
            {
                var supabaseConfig = SupabaseConfig.LoadFromConfig();
                if (supabaseConfig.IsValid())
                {
                    System.Diagnostics.Debug.WriteLine("Supabase configuration initialized successfully");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Failed to initialize Supabase configuration: " + ex.Message);
                throw;
            }
        }

        /// <summary>
        /// Initializes the AutoCount session at application startup.
        ///
        /// Per AutoCount docs:
        /// 1. Create DBSetting with server/database/credentials
        /// 2. Create UserSession
        /// 3. Call UserSession.Login()
        /// 4. Call SubProjectStartup()
        ///
        /// This must be done exactly once when the application starts.
        /// </summary>
        private void InitializeAutoCountSession()
        {
            try
            {
                // Load configuration from web.config
                var config = AutoCountConnectionConfig.LoadFromConfig();
                config.Validate();

                // Initialize the singleton session provider
                var sessionProvider = AutoCountSessionProvider.Instance as AutoCountSessionProvider;
                if (sessionProvider != null)
                {
                    sessionProvider.Initialize(config);
                    System.Diagnostics.Debug.WriteLine("AutoCount session initialized successfully");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Failed to initialize AutoCount session: " + ex.Message);
                // In production, you may want to log this to a file or monitoring system
                // and potentially prevent the application from starting if AutoCount is critical
                throw;
            }
        }
    }
}

