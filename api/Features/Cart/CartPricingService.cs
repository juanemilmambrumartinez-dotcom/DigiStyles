using DigiStyles.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Features.Cart;

public sealed class CartPricingService(DigiStylesDbContext db)
{
    public async Task<CartPricingResult> PriceAsync(IReadOnlyList<CartLineRequest>? request)
    {
        if (request is null || request.Count == 0)
            return CartPricingResult.Invalid(CartValidationError.Empty);

        if (request.Count > 20)
            return CartPricingResult.Invalid(CartValidationError.TooManyLines);

        if (request.Any(line => line.Quantity < 1 || line.Quantity > 10))
            return CartPricingResult.Invalid(CartValidationError.InvalidQuantity);

        var quantitiesByVariant = new Dictionary<int, int>();
        var variantIds = new List<int>();
        foreach (var line in request)
        {
            if (!quantitiesByVariant.ContainsKey(line.VariantId))
                variantIds.Add(line.VariantId);

            quantitiesByVariant[line.VariantId] = quantitiesByVariant.GetValueOrDefault(line.VariantId) + line.Quantity;
        }

        if (quantitiesByVariant.Values.Any(quantity => quantity > 10))
            return CartPricingResult.Invalid(CartValidationError.AccumulatedQuantityTooHigh);

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
                return new CartPricingLine(variantId, null, null, null, null, null, null,
                    requestedQuantity, 0, 0, null, 0, CartLineStatus.Unavailable);

            var unitPrice = variant.OverridePrice ?? variant.Product.BasePrice;
            var imageUrl = variant.Product.Images.OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault();
            if (variant.Stock <= 0)
                return new CartPricingLine(variant.Id, variant.ProductId, variant.Product.Slug, variant.Product.Name,
                    variant.Size, variant.Color, imageUrl, requestedQuantity, 0, variant.Stock, unitPrice, 0,
                    CartLineStatus.OutOfStock);

            var acceptedQuantity = Math.Min(requestedQuantity, variant.Stock);
            var status = acceptedQuantity == requestedQuantity
                ? CartLineStatus.Ok
                : CartLineStatus.InsufficientStock;

            return new CartPricingLine(variant.Id, variant.ProductId, variant.Product.Slug, variant.Product.Name,
                variant.Size, variant.Color, imageUrl, requestedQuantity, acceptedQuantity, variant.Stock, unitPrice,
                unitPrice * acceptedQuantity, status);
        }).ToList();

        return CartPricingResult.Valid(lines);
    }
}

public sealed record CartPricingResult(CartValidationError? Error, IReadOnlyList<CartPricingLine> Lines)
{
    public static CartPricingResult Invalid(CartValidationError error) => new(error, []);
    public static CartPricingResult Valid(IReadOnlyList<CartPricingLine> lines) => new(null, lines);
}

public sealed record CartPricingLine(
    int VariantId,
    int? ProductId,
    string? Slug,
    string? ProductName,
    string? Size,
    string? Color,
    string? ImageUrl,
    int RequestedQuantity,
    int AcceptedQuantity,
    int Stock,
    decimal? UnitPrice,
    decimal LineSubtotal,
    CartLineStatus Status);

public enum CartLineStatus
{
    Ok,
    InsufficientStock,
    OutOfStock,
    Unavailable
}

public enum CartValidationError
{
    Empty,
    TooManyLines,
    InvalidQuantity,
    AccumulatedQuantityTooHigh
}