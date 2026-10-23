namespace DigiStyles.Api.Features.Catalog;

public sealed record CategoryResponse(int Id, string Name, string Slug);
public sealed record ProductImageResponse(string Url, int SortOrder);
public sealed record ProductVariantResponse(int Id, string Size, string Color, int Stock, decimal? Price);
public sealed record ProductListItemResponse(int Id, string Name, string Slug, string Brand, decimal Price, string Category, string? ImageUrl);
public sealed record ProductDetailResponse(int Id, string Name, string Slug, string Description, string Brand, decimal BasePrice, string Category, IReadOnlyList<ProductImageResponse> Images, IReadOnlyList<ProductVariantResponse> Variants);
public sealed record ProductPageResponse(IReadOnlyList<ProductListItemResponse> Items, int Page, int PageSize, int TotalCount, int TotalPages);
