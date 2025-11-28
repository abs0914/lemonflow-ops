using System;
using System.Threading;
using AutoCount.Authentication;
using AutoCount.Data;
using AutoCount.MainEntry;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Singleton provider for AutoCount UserSession and DBSetting.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting
    /// 
    /// CRITICAL: UserSession must only be initiated once per running application.
    /// This class ensures thread-safe, single-instance initialization and access.
    /// 
    /// Integration Method: "Interface with API – Web service"
    /// https://wiki.autocountsoft.com/wiki/Integration_Methods
    /// </summary>
    public interface IAutoCountSessionProvider
    {
        /// <summary>
        /// Gets the initialized UserSession. Throws if initialization failed.
        /// </summary>
        UserSession GetUserSession();

        /// <summary>
        /// Gets the DBSetting used for the connection.
        /// </summary>
        DBSetting GetDBSetting();

        /// <summary>
        /// Checks if the session is properly initialized and connected.
        /// </summary>
        bool IsInitialized { get; }

        /// <summary>
        /// Gets any initialization error message if initialization failed.
        /// </summary>
        string InitializationError { get; }
    }

    /// <summary>
    /// Thread-safe singleton implementation of IAutoCountSessionProvider.
    /// </summary>
    public class AutoCountSessionProvider : IAutoCountSessionProvider
    {
        private static readonly Lazy<AutoCountSessionProvider> _instance =
            new Lazy<AutoCountSessionProvider>(() => new AutoCountSessionProvider(), LazyThreadSafetyMode.ExecutionAndPublication);

        private UserSession _userSession;
        private DBSetting _dbSetting;
        private bool _isInitialized;
        private string _initializationError;
        private readonly object _lockObject = new object();

        public static IAutoCountSessionProvider Instance
        {
            get { return _instance.Value; }
        }

        private AutoCountSessionProvider()
        {
            _isInitialized = false;
            _initializationError = null;
        }

        /// <summary>
        /// Initializes the AutoCount session with the provided configuration.
        /// This must be called exactly once at application startup.
        /// 
        /// Per AutoCount docs: "3 MainEntry to start a subProject"
        /// https://wiki.autocountsoft.com/wiki/AutoCount_Accounting_2.1_API#3_MainEntry_to_start_a_subProject
        /// </summary>
        public void Initialize(AutoCountConnectionConfig config)
        {
            if (config == null)
                throw new ArgumentNullException("config");

            lock (_lockObject)
            {
                if (_isInitialized)
                {
                    throw new InvalidOperationException("AutoCount session is already initialized. Cannot initialize twice.");
                }

                try
                {
                    // Ensure configuration is complete and valid before attempting to connect.
                    config.Validate();

                    // Step 1: Create DBSetting with SQL Authentication
                    // Per docs: https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting
                    // Use constructor overload: DBSetting(DBServerType, serverName, sqlUser, sqlPassword, dbName)
                    var dbSetting = new DBSetting(
                        config.DBServerType,
                        config.ServerName,
                        config.SqlUsername,
                        config.SqlPassword,
                        config.DatabaseName);

                    // Step 2: Create UserSession with DBSetting
                    var userSession = new UserSession(dbSetting);

                    // Step 3: Login to AutoCount
                    var loginSuccess = userSession.Login(config.AutoCountUsername, config.AutoCountPassword);
                    if (!loginSuccess)
                    {
                        throw new InvalidOperationException("Failed to login to AutoCount Accounting with the provided credentials.");
                    }

                    // Step 4: SubProjectStartup (required for non-UI integration)
                    // Note: This triggers license validation via gRPC to AutoCount Server.
                    // If the gRPC connection fails (e.g., in IIS service context), we'll
                    // try to continue without it, but some features may not work.
                    var startup = new Startup();
                    try
                    {
                        startup.SubProjectStartup(userSession);
                    }
                    catch (Exception subProjectEx)
                    {
                        // Log the SubProjectStartup error but continue
                        System.Diagnostics.Debug.WriteLine("SubProjectStartup failed (may affect some features): " + subProjectEx.Message);

                        // Check if this is a license/gRPC connection error
                        if (subProjectEx.Message.Contains("Fail to connect to AutoCount Server") ||
                            subProjectEx.Message.Contains("RemoteLicense"))
                        {
                            // Log warning but allow initialization to continue
                            System.Diagnostics.Debug.WriteLine("WARNING: AutoCount Server license validation failed. Some features may be limited.");
                            _initializationError = "License validation skipped: " + subProjectEx.Message;
                        }
                        else
                        {
                            // For other errors, re-throw
                            throw;
                        }
                    }

                    _dbSetting = dbSetting;
                    _userSession = userSession;
                    _isInitialized = true;
                }
                catch (Exception ex)
                {
                    _initializationError = ex.Message;
                    _userSession = null;
                    _dbSetting = null;
                    _isInitialized = false;
                    throw;
                }
            }
        }

        public UserSession GetUserSession()
        {
            lock (_lockObject)
            {
                if (!_isInitialized)
                {
                    throw new InvalidOperationException(
                        "AutoCount session not initialized. Error: " + (_initializationError ?? "Unknown error"));
                }
                return _userSession;
            }
        }

        public DBSetting GetDBSetting()
        {
            lock (_lockObject)
            {
                if (!_isInitialized)
                {
                    throw new InvalidOperationException("AutoCount session not initialized.");
                }
                return _dbSetting;
            }
        }

        public bool IsInitialized
        {
            get
            {
                lock (_lockObject)
                {
                    return _isInitialized;
                }
            }
        }

        public string InitializationError
        {
            get
            {
                lock (_lockObject)
                {
                    return _initializationError;
                }
            }
        }
    }
}

