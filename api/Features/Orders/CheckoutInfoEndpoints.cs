using Microsoft.Extensions.Options;

namespace DigiStyles.Api.Features.Orders;

public static class CheckoutInfoEndpoints
{
    public static void MapCheckoutInfoEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/checkout/info", (IOptions<ShippingOptions> shippingOptions, HttpContext httpContext) =>
        {
            httpContext.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new
            {
                currency = "DOP",
                shippingCost = shippingOptions.Value.FixedCost
            });
        });
    }
}