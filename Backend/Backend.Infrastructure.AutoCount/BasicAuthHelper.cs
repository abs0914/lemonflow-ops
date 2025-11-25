using System;
using System.Text;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Helper to validate HTTP Basic authentication credentials against
    /// the configured Lemon-co API username and password.
    ///
    /// This class is independent from any specific HTTP framework; it
    /// operates purely on the value of the Authorization header's
    /// "parameter" portion (the Base64-encoded username:password).
    /// </summary>
    public class BasicAuthHelper
    {
        private readonly BasicAuthConfig _config;

        public BasicAuthHelper(BasicAuthConfig config)
        {
            _config = config ?? throw new ArgumentNullException("config");
        }

        /// <summary>
        /// Validates the supplied Basic Authorization header parameter
        /// against configured credentials.
        /// </summary>
        /// <param name="basicAuthParameter">
        /// The Base64-encoded "username:password" portion of the
        /// Authorization header.
        /// </param>
        /// <param name="username">Outputs the decoded username on success.</param>
        /// <param name="errorMessage">Error description if validation fails.</param>
        /// <returns>True when credentials are valid; otherwise false.</returns>
        public bool TryValidateCredentials(string basicAuthParameter, out string username, out string errorMessage)
        {
            username = null;
            errorMessage = null;

            if (string.IsNullOrWhiteSpace(basicAuthParameter))
            {
                errorMessage = "Missing Basic authentication credentials.";
                return false;
            }

            string decoded;
            try
            {
                var bytes = Convert.FromBase64String(basicAuthParameter);
                decoded = Encoding.UTF8.GetString(bytes);
            }
            catch (FormatException)
            {
                errorMessage = "Invalid Base64 encoding for Basic authentication credentials.";
                return false;
            }

            int separatorIndex = decoded.IndexOf(':');
            if (separatorIndex <= 0)
            {
                errorMessage = "Invalid Basic authentication credential format.";
                return false;
            }

            var suppliedUsername = decoded.Substring(0, separatorIndex);
            var suppliedPassword = decoded.Substring(separatorIndex + 1);

            if (!string.Equals(suppliedUsername, _config.Username, StringComparison.Ordinal) ||
                !string.Equals(suppliedPassword, _config.Password, StringComparison.Ordinal))
            {
                errorMessage = "Invalid username or password.";
                return false;
            }

            username = suppliedUsername;
            return true;
        }
    }
}
