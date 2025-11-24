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

        public static IAutoCountSessionProvider Instance => _instance.Value;

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
            lock (_lockObject)
            {
                if (_isInitialized)
                {
                    throw new InvalidOperationException("AutoCount session is already initialized. Cannot initialize twice.");
                }

                try
                {
                    // Step 1: Create DBSetting
                    // Per docs: Configure DBServerType, serverName, dbName, and credentials
                    _dbSetting = new DBSetting();
                    _dbSetting.DBServerType = config.DBServerType;
                    _dbSetting.ServerName = config.ServerName;
                    _dbSetting.DatabaseName = config.DatabaseName;
                    _dbSetting.UserName = config.SqlUsername;
                    _dbSetting.Password = config.SqlPassword;

                    // Step 2: Create UserSession
                    _userSession = new UserSession();

                    // Step 3: Login to AutoCount
                    // Per docs: UserSession.Login(dbSetting, autoCountUsername, autoCountPassword)
                    bool loginSuccess = _userSession.Login(_dbSetting, config.AutoCountUsername, config.AutoCountPassword);
                    if (!loginSuccess)
                    {
                        throw new InvalidOperationException("Failed to login to AutoCount. Check credentials.");
                    }

                    // Step 4: SubProjectStartup
                    // Per docs: "After UserSession.Login(...) succeeds, call startup.SubProjectStartup(userSession, ...)"
                    // This is required for non-UI, unattended integration.
                    var startup = new Startup();
                    startup.SubProjectStartup(_userSession, StartupPlugInOption.LoadStandardPlugIn);

                    _isInitialized = true;
                }
                catch (Exception ex)
                {
                    _initializationError = ex.Message;
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
                        $"AutoCount session not initialized. Error: {_initializationError ?? "Unknown error"}");
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

