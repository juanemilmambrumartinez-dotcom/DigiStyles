namespace DigiStyles.Api.Domain.Entities;

public enum OrderStatus
{
    Pendiente,
    Confirmado,
    Enviado,
    Entregado,
    Cancelado
}

public enum PaymentMethod
{
    Transferencia,
    ContraEntrega
}

public sealed class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string OrderNumber { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public OrderStatus Status { get; set; } = OrderStatus.Pendiente;
    public PaymentMethod PaymentMethod { get; set; }
    public string Currency { get; set; } = "DOP";
    public decimal Subtotal { get; set; }
    public decimal ShippingCost { get; set; }
    public decimal Total { get; set; }
    public required string ContactName { get; set; }
    public required string Phone { get; set; }
    public required string Address { get; set; }
    public required string City { get; set; }
    public string? Note { get; set; }
    public required string IdempotencyKey { get; set; }
    public required byte[] RequestHash { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ICollection<OrderItem> Items { get; set; } = [];
}