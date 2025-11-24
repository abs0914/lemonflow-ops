using System;
using System.Configuration;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Configuration class for Supabase integration.
    /// Loads Supabase settings from web.config appSettings.
    /// </summary>
    public class SupabaseConfig
    {
        /// <summary>
        /// Supabase project URL
        /// </summary>
        public string Url { get; set; }

        /// <summary>
        /// Supabase anonymous key for client-side access
        /// </summary>
        public string AnonKey { get; set; }

        /// <summary>
        /// JWT secret for token validation
        /// </summary>
        public string JwtSecret { get; set; }

        /// <summary>
        /// JWT issuer URL
        /// </summary>
        public string JwtIssuer { get; set; }

        /// <summary>
        /// Loads Supabase configuration from web.config appSettings.
        /// </summary>
        /// <returns>SupabaseConfig instance with loaded settings</returns>
        /// <exception cref="ConfigurationErrorsException">Thrown if required settings are missing</exception>
        public static SupabaseConfig LoadFromConfig()
        {
            var config = new SupabaseConfig
            {
                Url = ConfigurationManager.AppSettings["Supabase:Url"],
                AnonKey = ConfigurationManager.AppSettings["Supabase:AnonKey"],
                JwtSecret = ConfigurationManager.AppSettings["Supabase:JwtSecret"],
                JwtIssuer = ConfigurationManager.AppSettings["Supabase:JwtIssuer"]
            };

            // Validate required settings
            if (string.IsNullOrWhiteSpace(config.Url))
                throw new ConfigurationErrorsException("Supabase:Url is not configured in appSettings");
            if (string.IsNullOrWhiteSpace(config.AnonKey))
                throw new ConfigurationErrorsException("Supabase:AnonKey is not configured in appSettings");
            if (string.IsNullOrWhiteSpace(config.JwtSecret))
                throw new ConfigurationErrorsException("Supabase:JwtSecret is not configured in appSettings");
            if (string.IsNullOrWhiteSpace(config.JwtIssuer))
                throw new ConfigurationErrorsException("Supabase:JwtIssuer is not configured in appSettings");

            return config;
        }

        /// <summary>
        /// Validates that all required Supabase settings are configured.
        /// </summary>
        /// <returns>True if all settings are valid; otherwise false</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Url) &&
                   !string.IsNullOrWhiteSpace(AnonKey) &&
                   !string.IsNullOrWhiteSpace(JwtSecret) &&
                   !string.IsNullOrWhiteSpace(JwtIssuer);
        }
    }
}

