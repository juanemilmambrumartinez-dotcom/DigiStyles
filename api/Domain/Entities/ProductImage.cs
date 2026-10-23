namespace DigiStyles.Api.Domain.Entities;

public sealed class ProductImage
{
    public int Id { get; set; }
    public required string Url { get; set; }
    public int SortOrder { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
}
