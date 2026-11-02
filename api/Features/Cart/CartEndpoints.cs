using DigiStyles.Api.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Features.Cart;

public static class CartEndpoints
{
    public static void MapCartEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/api/cart/validate", async Task<Results<Ok<CartValidationResponse>, BadRequest<string>>>
            (DigiStylesDbContext db, IReadOnlyList<CartLineRequest>? request) =>
        {
            if (request is null || request.Count == 0)
                return TypedResults.BadRequest("La lista de líneas del carrito no puede estar vacía.");

            if (request.Count > 20)
                return TypedResults.BadRequest("El carrito no puede contener más de 20 líneas.");

            if (request.Any(line => line.Quantity < 1 || line.Quantity > 10))
                return TypedResults.BadRequest("La cantidad de cada línea debe estar entre 1 y 10.");

            var quantitiesByVariant = new Dictionary<int, int>();
            var variantIds = new List<int>();
            foreach (var line in request)
            {
                if (!quantitiesByVariant.ContainsKey(line.VariantId))
                    variantIds.Add(line.VariantId);

                quantitiesByVariant[line.VariantId] = quantitiesByVariant.GetValueOrDefault(line.VariantId) + line.Quantity;
            }

            if (quantitiesByVariant.Values.Any(quantity => quantity > 10))
                return TypedResults.BadRequest("La cantidad acumulada de una variante no puede superar 10.");

            var variants = await db.ProductVariants
                .AsNoTracking()
                .Where(variant => variantIds.Contains(variant.Id))
                .Include(variant => variant.Product)
                .ThenInclude(product => product.Images)
                .ToDictionaryAsync(variant => variant.Id);

            var lines = variantIds.Select(variantId =>
            {
                var requestedQuantity = quantitiesByVariant[variantId];
                if (!variants.TryGetValue(variantId, out var variant) || !variant.Product.IsActive)
                    return new CartLineResponse(variantId, null, null, null, null, null, null,
                        requestedQuantity, 0, null, 0, "no_disponible", "La variante no existe o el producto no está disponible.");

                var unitPrice = variant.OverridePrice ?? variant.Product.BasePrice;
                var imageUrl = variant.Product.Images.OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault();
                if (variant.Stock <= 0)
                    return new CartLineResponse(variant.Id, variant.ProductId, variant.Product.Slug, variant.Product.Name,
                        variant.Size, variant.Color, imageUrl, requestedQuantity, 0, unitPrice, 0,
                        "sin_stock", "La variante no tiene stock disponible.");

                var acceptedQuantity = Math.Min(requestedQuantity, variant.Stock);
                var status = acceptedQuantity == requestedQuantity ? "ok" : "stock_insuficiente";
                var message = status == "ok"
                    ? "La línea está disponible."
                    : $"Solo hay {variant.Stock} unidades disponibles; se acepta esa cantidad.";

                return new CartLineResponse(variant.Id, variant.ProductId, variant.Product.Slug, variant.Product.Name,
                    variant.Size, variant.Color, imageUrl, requestedQuantity, acceptedQuantity, unitPrice,
                    unitPrice * acceptedQuantity, status, message);
            }).ToList();

            return TypedResults.Ok(new CartValidationResponse(lines, lines.Sum(line => line.LineSubtotal)));
        });
    }
}