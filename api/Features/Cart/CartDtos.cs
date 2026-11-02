namespace DigiStyles.Api.Features.Cart;

public sealed record CartLineRequest(int VariantId, int Quantity);
public sealed record CartLineResponse(
    int VariantId,
    int? ProductId,
    string? Slug,
    string? ProductName,
    string? Size,
    string? Color,
    string? ImageUrl,
    int RequestedQuantity,
    int AcceptedQuantity,
    decimal? UnitPrice,
    decimal LineSubtotal,
    string Status,
    string Message);
public sealed record CartValidationResponse(IReadOnlyList<CartLineResponse> Lines, decimal Total);