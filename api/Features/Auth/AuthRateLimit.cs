using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace DigiStyles.Api.Features.Auth;

public static class AuthRateLimit
{
    public static string GetClientIp(HttpContext httpContext, string? internalApiKey)
    {
        var suppliedKey = httpContext.Request.Headers["X-Internal-Key"].ToString();
        if (!string.IsNullOrWhiteSpace(internalApiKey) && KeysMatch(suppliedKey, internalApiKey))
        {
            var suppliedIp = httpContext.Request.Headers["X-Client-IP"].ToString();
            if (IPAddress.TryParse(suppliedIp, out var clientIp)) return clientIp.ToString();
        }

        return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static bool KeysMatch(string suppliedKey, string configuredKey)
    {
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(suppliedKey),
            Encoding.UTF8.GetBytes(configuredKey));
    }
}
