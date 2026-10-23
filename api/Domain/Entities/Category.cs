namespace DigiStyles.Api.Domain.Entities;

public sealed class Category
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public ICollection<Product> Products { get; set; } = [];
}
