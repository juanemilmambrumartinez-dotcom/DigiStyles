using DigiStyles.Api.Features.Cart;

namespace DigiStyles.Api.Features.Orders;

public sealed record CreateOrderRequest(
    IReadOnlyList<CartLineRequest> Lines,
    string PaymentMethod,
    OrderContactRequest Contact,
    decimal ExpectedTotal);

public sealed record OrderContactRequest(
    string Name,
    string Phone,
    string Address,
    string City,
    string? Note);

public sealed record OrderResponse(
    Guid Id,
    string OrderNumber,
    string Status,
    string PaymentMethod,
    string Currency,
    decimal Subtotal,
    decimal Shipping,
    decimal Total,
    DateTime Date,
    IReadOnlyList<OrderItemResponse> Lines,
    OrderDeliveryResponse Delivery,
    OrderBankTransferResponse? BankTransfer);

public sealed record OrderSummaryResponse(
    Guid Id,
    string OrderNumber,
    string Status,
    string PaymentMethod,
    decimal Total,
    DateTime Date,
    int TotalItems);

public sealed record OrderItemResponse(
    int? VariantId,
    string ProductName,
    string Size,
    string Color,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);

public sealed record OrderDeliveryResponse(
    string Name,
    string Phone,
    string Address,
    string City,
    string? Note);

public sealed record OrderBankTransferResponse(
    string Bank,
    string AccountHolder,
    string AccountNumber,
    string AccountType,
    string PaymentReference);

public sealed record OrderErrorResponse(string Code, string Message, object? Details = null);

public sealed record OrderStockLineResponse(int VariantId, string Status, string Message);