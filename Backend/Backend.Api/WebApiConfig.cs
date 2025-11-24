using System.Web.Http;

namespace Backend.Api
{
    /// <summary>
    /// Web API configuration and route registration.
    /// </summary>
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // Web API configuration and services
            // TODO: Enable CORS when System.Web.Http.Cors package is available
            // config.EnableCors();

            // Web API routes
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );

            // TODO: Configure JSON serialization when System.Net.Http.Formatting package is available
            // var jsonFormatter = config.Formatters.JsonFormatter;
            // jsonFormatter.SerializerSettings.NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore;
            // jsonFormatter.SerializerSettings.Formatting = Newtonsoft.Json.Formatting.Indented;
        }
    }
}

