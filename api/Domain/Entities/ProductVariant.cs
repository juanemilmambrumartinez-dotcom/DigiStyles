namespace DigiStyles.Api.Domain.Entities;

public sealed class ProductVariant
{
    public int Id { get; set; }
    public required string Size { get; set; }
    public required string Color { get; set; }
    public int Stock { get; set; }
    public decimal? OverridePrice { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
}
