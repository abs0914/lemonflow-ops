using System;
using System.Configuration;
using AutoCount.Data;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Configuration for AutoCount database and user connection.
    /// 
    /// Per AutoCount 2.1 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Initiate_UserSession_and_DBSetting
    /// 
    /// This class encapsulates all settings required for DBSetting initialization.
    /// </summary>
    public class AutoCountConnectionConfig
    {
        /// <summary>
        /// SQL Server type (e.g., SQL2000, SQL2012, SQL2016, SQL2019).
        /// Per docs: "DBServerType (e.g., SQL2000/SQL2012 – use the correct enum based on SQL Server version)"
        /// </summary>
        public DBServerType DBServerType { get; set; }

        /// <summary>
        /// SQL Server name or IP address.
        /// </summary>
        public string ServerName { get; set; }

        /// <summary>
        /// AutoCount database name.
        /// </summary>
        public string DatabaseName { get; set; }

        /// <summary>
        /// SQL Server login username (typically 'sa' or a SQL login).
        /// </summary>
        public string SqlUsername { get; set; }

        /// <summary>
        /// SQL Server login password.
        /// WARNING: In production, use secure secret storage (e.g., Azure Key Vault, AWS Secrets Manager).
        /// Do not hardcode or store in plain text in config files.
        /// </summary>
        public string SqlPassword { get; set; }

        /// <summary>
        /// AutoCount user login username.
        /// </summary>
        public string AutoCountUsername { get; set; }

        /// <summary>
        /// AutoCount user login password.
        /// WARNING: In production, use secure secret storage.
        /// </summary>
        public string AutoCountPassword { get; set; }

        /// <summary>
        /// Optional: Connection timeout in seconds.
        /// </summary>
        public int ConnectionTimeoutSeconds { get; set; }

        /// <summary>
        /// Loads configuration from web.config or app.config appSettings.
        /// 
        /// Expected keys:
        /// - AutoCount:DBServerType (e.g., "SQL2012")
        /// - AutoCount:ServerName
        /// - AutoCount:DatabaseName
        /// - AutoCount:SqlUsername
        /// - AutoCount:SqlPassword
        /// - AutoCount:AutoCountUsername
        /// - AutoCount:AutoCountPassword
        /// - AutoCount:ConnectionTimeoutSeconds (optional)
        /// </summary>
        public static AutoCountConnectionConfig LoadFromConfig()
        {
            var config = new AutoCountConnectionConfig();

            try
            {
                var dbServerTypeStr = ConfigurationManager.AppSettings["AutoCount:DBServerType"];
                if (string.IsNullOrEmpty(dbServerTypeStr))
                    throw new ConfigurationErrorsException("AutoCount:DBServerType not configured");

                DBServerType dbServerType;
                if (!Enum.TryParse<DBServerType>(dbServerTypeStr, out dbServerType))
                    throw new ConfigurationErrorsException("Invalid DBServerType: " + dbServerTypeStr);

                config.DBServerType = dbServerType;
                config.ServerName = GetRequiredSetting("AutoCount:ServerName");
                config.DatabaseName = GetRequiredSetting("AutoCount:DatabaseName");
                config.SqlUsername = GetRequiredSetting("AutoCount:SqlUsername");
                config.SqlPassword = GetRequiredSetting("AutoCount:SqlPassword");
                config.AutoCountUsername = GetRequiredSetting("AutoCount:AutoCountUsername");
                config.AutoCountPassword = GetRequiredSetting("AutoCount:AutoCountPassword");

                var timeoutStr = ConfigurationManager.AppSettings["AutoCount:ConnectionTimeoutSeconds"];
                int timeout;
                if (!string.IsNullOrEmpty(timeoutStr) && int.TryParse(timeoutStr, out timeout))
                {
                    config.ConnectionTimeoutSeconds = timeout;
                }

                return config;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to load AutoCount configuration from config file.", ex);
            }
        }

        private static string GetRequiredSetting(string key)
        {
            var value = ConfigurationManager.AppSettings[key];
            if (string.IsNullOrEmpty(value))
                throw new ConfigurationErrorsException("Required setting '" + key + "' not found in configuration");
            return value;
        }

        /// <summary>
        /// Validates the configuration for completeness.
        /// </summary>
        public void Validate()
        {
            if (string.IsNullOrWhiteSpace(ServerName))
                throw new InvalidOperationException("ServerName is required");
            if (string.IsNullOrWhiteSpace(DatabaseName))
                throw new InvalidOperationException("DatabaseName is required");
            if (string.IsNullOrWhiteSpace(SqlUsername))
                throw new InvalidOperationException("SqlUsername is required");
            if (string.IsNullOrWhiteSpace(SqlPassword))
                throw new InvalidOperationException("SqlPassword is required");
            if (string.IsNullOrWhiteSpace(AutoCountUsername))
                throw new InvalidOperationException("AutoCountUsername is required");
            if (string.IsNullOrWhiteSpace(AutoCountPassword))
                throw new InvalidOperationException("AutoCountPassword is required");
        }
    }
}

