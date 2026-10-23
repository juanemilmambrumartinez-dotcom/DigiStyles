using DigiStyles.Api.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Features.Catalog;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/categories", async (DigiStylesDbContext db) =>
            await db.Categories.AsNoTracking().OrderBy(category => category.Name)
                .Select(category => new CategoryResponse(category.Id, category.Name, category.Slug)).ToListAsync());

        routes.MapGet("/api/products", async Task<Results<Ok<ProductPageResponse>, BadRequest<string>>>
            (DigiStylesDbContext db, string? category, string? size, decimal? minPrice,
             decimal? maxPrice, string? search, int page = 1, int pageSize = 12) =>
        {
            if (page < 1 || pageSize < 1 || pageSize > 50 || minPrice < 0 || maxPrice < 0 ||
                (minPrice.HasValue && maxPrice.HasValue && minPrice > maxPrice))
                return TypedResults.BadRequest("Los parámetros de paginación o precio no son válidos.");

            IQueryable<Domain.Entities.Product> query = db.Products.AsNoTracking()
                .Where(product => product.IsActive)
                .Include(product => product.Category)
                .Include(product => product.Variants)
                .Include(product => product.Images);

            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(product => product.Category.Slug == category.Trim().ToLower());
            if (!string.IsNullOrWhiteSpace(size)) query = query.Where(product => product.Variants.Any(variant => variant.Size == size.Trim()));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(product => product.Name.ToLower().Contains(term) || product.Brand.ToLower().Contains(term));
            }
            if (minPrice.HasValue)
                query = query.Where(product => product.Variants.Any()
                    ? product.Variants.Any(variant =>
                        (variant.OverridePrice ?? product.BasePrice) >= minPrice.Value)
                    : product.BasePrice >= minPrice.Value);
            if (maxPrice.HasValue)
                query = query.Where(product => product.Variants.Any()
                    ? product.Variants.Any(variant =>
                        (variant.OverridePrice ?? product.BasePrice) <= maxPrice.Value)
                    : product.BasePrice <= maxPrice.Value);

            var totalCount = await query.CountAsync();
            var products = await query.OrderBy(product => product.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var items = products.Select(product => new ProductListItemResponse(product.Id, product.Name, product.Slug,
                product.Brand, product.Variants.Any() ? product.Variants.Min(variant => variant.OverridePrice ?? product.BasePrice) : product.BasePrice,
                product.Category.Name, product.Images.OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault())).ToList();

            return TypedResults.Ok(new ProductPageResponse(items, page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)));
        });

        routes.MapGet("/api/products/{slug}", async Task<Results<Ok<ProductDetailResponse>, NotFound>>
            (DigiStylesDbContext db, string slug) =>
        {
            var product = await db.Products.AsNoTracking().Where(item => item.IsActive && item.Slug == slug)
                .Include(item => item.Category).Include(item => item.Variants).Include(item => item.Images).SingleOrDefaultAsync();
            if (product is null) return TypedResults.NotFound();

            var response = new ProductDetailResponse(product.Id, product.Name, product.Slug, product.Description, product.Brand,
                product.BasePrice, product.Category.Name,
                product.Images.OrderBy(image => image.SortOrder).Select(image => new ProductImageResponse(image.Url, image.SortOrder)).ToList(),
                product.Variants.Select(variant => new ProductVariantResponse(variant.Id, variant.Size, variant.Color, variant.Stock,
                    variant.OverridePrice)).ToList());
            return TypedResults.Ok(response);
        });
    }
}
