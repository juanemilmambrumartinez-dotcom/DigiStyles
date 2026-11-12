namespace DigiStyles.Api.Features.Orders;

public sealed record AdminOrderSummaryResponse(
    Guid Id,
    string OrderNumber,
    string Status,
    string PaymentMethod,
    decimal Total,
    DateTime Date,
    int TotalItems,
    string ContactName);

public sealed record AdminOrderDetailResponse(
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
    OrderBankTransferResponse? BankTransfer,
    string UserEmail);

public sealed record AdminOrderStatusRequest(string Status);

public sealed record AdminOrderStatusResult(
    AdminOrderStatusOutcome Outcome,
    AdminOrderDetailResponse? Order)
{
    public static AdminOrderStatusResult Updated(AdminOrderDetailResponse order) =>
        new(AdminOrderStatusOutcome.Updated, order);

    public static AdminOrderStatusResult AlreadyInStatus(AdminOrderDetailResponse order) =>
        new(AdminOrderStatusOutcome.AlreadyInStatus, order);

    public static AdminOrderStatusResult NotFound =>
        new(AdminOrderStatusOutcome.NotFound, null);

    public static AdminOrderStatusResult InvalidTransition =>
        new(AdminOrderStatusOutcome.InvalidTransition, null);
}

public enum AdminOrderStatusOutcome
{
    Updated,
    AlreadyInStatus,
    NotFound,
    InvalidTransition
}
