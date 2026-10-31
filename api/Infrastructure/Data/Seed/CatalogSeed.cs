using DigiStyles.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Infrastructure.Data.Seed;

public static class CatalogSeed
{
    public static async Task SeedAsync(DigiStylesDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.Products.AnyAsync(cancellationToken)) return;

        var ropa = new Category { Name = "Ropa", Slug = "ropa" };
        var tenis = new Category { Name = "Tenis", Slug = "tenis" };
        var accesorios = new Category { Name = "Accesorios", Slug = "accesorios" };

        var products = new List<Product>
        {
            Product("Hoodie Urban Black", "hoodie-urban-black", "Sudadera urbana premium de algodón pesado.", "DigiWear", 2450m, ropa, 15, ("Negro", null)),
            Product("Camiseta Signature", "camiseta-signature", "Camiseta oversize con estampado frontal.", "DigiWear", 1250m, ropa, 20, ("Blanco", null)),
            Product("Pantalón Cargo Noir", "pantalon-cargo-noir", "Cargo de corte relajado con bolsillos laterales.", "Northline", 2100m, ropa, 18, ("Negro", 2200m)),
            Product("Chaqueta Runner", "chaqueta-runner", "Chaqueta ligera resistente al viento.", "Northline", 3200m, ropa, 12, ("Azul", null)),
            Product("Runner Volt", "runner-volt", "Tenis ligeros con amortiguación urbana.", "Volt", 4200m, tenis, 10, ("Negro", 4350m)),
            Product("Court Classic", "court-classic", "Tenis clásicos inspirados en las canchas.", "Volt", 3800m, tenis, 14, ("Blanco", null)),
            Product("Trail Spectrum", "trail-spectrum", "Tenis versátiles para ciudad y sendero.", "Mountain", 4600m, tenis, 9, ("Gris", 4750m)),
            Product("Street Low", "street-low", "Tenis bajos con suela acolchonada.", "StreetOne", 3400m, tenis, 16, ("Negro", null)),
            Product("Gorra Core", "gorra-core", "Gorra ajustable con bordado delantero.", "DigiWear", 850m, accesorios, 25, ("Negro", null)),
            Product("Mochila Transit", "mochila-transit", "Mochila resistente con compartimento acolchado.", "Transit", 2750m, accesorios, 11, ("Negro", null)),
            Product("Cinturón Loop", "cinturon-loop", "Cinturón urbano con hebilla metálica.", "Northline", 950m, accesorios, 22, ("Negro", 1100m)),
            Product("Lentes Shadow", "lentes-shadow", "Lentes estilo retro con protección UV.", "Shadow", 1800m, accesorios, 13, ("Negro", null)),
        };

        db.AddRange(products);
        await db.SaveChangesAsync(cancellationToken);

        static Product Product(string name, string slug, string description, string brand, decimal price,
            Category category, int stock, (string color, decimal? overridePrice) option) => new()
        {
            Name = name,
            Slug = slug,
            Description = description,
            Brand = brand,
            BasePrice = price,
            IsActive = true,
            Category = category,
            Variants = [new ProductVariant { Size = category.Slug == "ropa" ? "M" : category.Slug == "tenis" ? "42" : "Único", Color = option.color, Stock = stock, OverridePrice = option.overridePrice }],
            Images = [new ProductImage { Url = $"/placeholders/placeholder-{category.Slug}.svg", SortOrder = 1 }]
        };
    }
}
