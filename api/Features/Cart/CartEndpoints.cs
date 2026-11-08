using DigiStyles.Api.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Features.Cart;

public static class CartEndpoints
{
    public static void MapCartEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/api/cart/validate", async Task<Results<Ok<CartValidationResponse>, BadRequest<string>>>
            (CartPricingService pricingService, IReadOnlyList<CartLineRequest>? request) =>
        {
            var pricing = await pricingService.PriceAsync(request);
            if (pricing.Error is not null)
                return TypedResults.BadRequest(pricing.Error switch
                {
                    CartValidationError.Empty => "La lista de líneas del carrito no puede estar vacía.",
                    CartValidationError.TooManyLines => "El carrito no puede contener más de 20 líneas.",
                    CartValidationError.InvalidQuantity => "La cantidad de cada línea debe estar entre 1 y 10.",
                    CartValidationError.AccumulatedQuantityTooHigh => "La cantidad acumulada de una variante no puede superar 10.",
                    _ => throw new InvalidOperationException()
                });

            var lines = pricing.Lines.Select(line => new CartLineResponse(line.VariantId, line.ProductId, line.Slug,
                line.ProductName, line.Size, line.Color, line.ImageUrl, line.RequestedQuantity, line.AcceptedQuantity,
                line.UnitPrice, line.LineSubtotal, line.Status switch
                {
                    CartLineStatus.Ok => "ok",
                    CartLineStatus.InsufficientStock => "stock_insuficiente",
                    CartLineStatus.OutOfStock => "sin_stock",
                    CartLineStatus.Unavailable => "no_disponible",
                    _ => throw new InvalidOperationException()
                }, line.Status switch
                {
                    CartLineStatus.Ok => "La línea está disponible.",
                    CartLineStatus.InsufficientStock => $"Solo hay {line.Stock} unidades disponibles; se acepta esa cantidad.",
                    CartLineStatus.OutOfStock => "La variante no tiene stock disponible.",
                    CartLineStatus.Unavailable => "La variante no existe o el producto no está disponible.",
                    _ => throw new InvalidOperationException()
                })).ToList();

            return TypedResults.Ok(new CartValidationResponse(lines, lines.Sum(line => line.LineSubtotal)));
        });
    }
}