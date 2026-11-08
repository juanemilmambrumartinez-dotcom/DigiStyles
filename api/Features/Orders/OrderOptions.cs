namespace DigiStyles.Api.Features.Orders;

public sealed class ShippingOptions
{
    public const string SectionName = "Shipping";

    public decimal FixedCost { get; set; }
}

public sealed class BankTransferOptions
{
    public const string SectionName = "BankTransfer";

    public required string BankName { get; set; }
    public required string AccountHolder { get; set; }
    public required string AccountNumber { get; set; }
    public required string AccountType { get; set; }
}

public sealed class OrderOptions
{
    public const string SectionName = "Orders";

    public int MaxPendingOrdersPerUser { get; set; } = 3;
}