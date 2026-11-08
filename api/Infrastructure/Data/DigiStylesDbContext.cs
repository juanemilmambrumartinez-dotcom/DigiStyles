using DigiStyles.Api.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Infrastructure.Data;

/// <summary>
/// Contexto principal de acceso a datos de DigiStyles, administrado por EF Core.
/// </summary>
public sealed class DigiStylesDbContext(DbContextOptions<DigiStylesDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.Name).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(token => token.Id);
            entity.Property(token => token.TokenHash).IsRequired().HasMaxLength(32);
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasOne(token => token.User)
                .WithMany()
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("Orders", tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_Orders_Status",
                    "[Status] IN ('Pendiente','Confirmado','Enviado','Entregado','Cancelado')");
                tableBuilder.HasCheckConstraint(
                    "CK_Orders_PaymentMethod",
                    "[PaymentMethod] IN ('Transferencia','ContraEntrega')");
                tableBuilder.HasCheckConstraint("CK_Orders_Currency", "[Currency] = 'DOP'");
                tableBuilder.HasCheckConstraint("CK_Orders_Subtotal_NonNegative", "[Subtotal] >= 0");
                tableBuilder.HasCheckConstraint("CK_Orders_ShippingCost_NonNegative", "[ShippingCost] >= 0");
                tableBuilder.HasCheckConstraint("CK_Orders_Total_NonNegative", "[Total] >= 0");
                tableBuilder.HasCheckConstraint("CK_Orders_Total_Matches", "[Total] = [Subtotal] + [ShippingCost]");
            });
            entity.HasKey(order => order.Id);
            entity.Property(order => order.OrderNumber).HasMaxLength(11).IsRequired();
            entity.HasIndex(order => order.OrderNumber).IsUnique();
            entity.Property(order => order.UserId).HasMaxLength(450).IsRequired();
            entity.HasIndex(order => new { order.UserId, order.IdempotencyKey }).IsUnique();
            entity.HasIndex(order => new { order.UserId, order.CreatedAtUtc });
            entity.Property(order => order.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(order => order.PaymentMethod).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(order => order.Currency).HasMaxLength(3).IsRequired();
            entity.Property(order => order.Subtotal).HasPrecision(18, 2);
            entity.Property(order => order.ShippingCost).HasPrecision(18, 2);
            entity.Property(order => order.Total).HasPrecision(18, 2);
            entity.Property(order => order.ContactName).HasMaxLength(100).IsRequired();
            entity.Property(order => order.Phone).HasMaxLength(20).IsRequired();
            entity.Property(order => order.Address).HasMaxLength(200).IsRequired();
            entity.Property(order => order.City).HasMaxLength(100).IsRequired();
            entity.Property(order => order.Note).HasMaxLength(300);
            entity.Property(order => order.IdempotencyKey).HasMaxLength(100).IsRequired();
            entity.Property(order => order.RequestHash).HasColumnType("varbinary(32)").IsRequired();
            entity.Property(order => order.CreatedAtUtc).IsRequired();
            entity.Property(order => order.UpdatedAtUtc).IsRequired();
            entity.HasOne(order => order.User)
                .WithMany()
                .HasForeignKey(order => order.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.ToTable("OrderItems", tableBuilder =>
            {
                tableBuilder.HasCheckConstraint("CK_OrderItems_Quantity_Range", "[Quantity] BETWEEN 1 AND 10");
                tableBuilder.HasCheckConstraint("CK_OrderItems_UnitPrice_NonNegative", "[UnitPrice] >= 0");
                tableBuilder.HasCheckConstraint("CK_OrderItems_LineTotal_Matches", "[LineTotal] = [UnitPrice] * [Quantity]");
            });
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Size).HasMaxLength(30).IsRequired();
            entity.Property(item => item.Color).HasMaxLength(50).IsRequired();
            entity.Property(item => item.UnitPrice).HasPrecision(18, 2);
            entity.Property(item => item.LineTotal).HasPrecision(18, 2);
            entity.HasOne(item => item.Order)
                .WithMany(order => order.Items)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.ProductVariant)
                .WithMany()
                .HasForeignKey(item => item.ProductVariantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.Property(category => category.Name).HasMaxLength(100).IsRequired();
            entity.Property(category => category.Slug).HasMaxLength(100).IsRequired();
            entity.HasIndex(category => category.Slug).IsUnique();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(product => product.Name).HasMaxLength(200).IsRequired();
            entity.Property(product => product.Slug).HasMaxLength(200).IsRequired();
            entity.Property(product => product.Description).HasMaxLength(2000).IsRequired();
            entity.Property(product => product.Brand).HasMaxLength(100).IsRequired();
            entity.Property(product => product.BasePrice).HasPrecision(18, 2);
            entity.HasIndex(product => product.Slug).IsUnique();
            entity.HasOne(product => product.Category)
                .WithMany(category => category.Products)
                .HasForeignKey(product => product.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProductVariant>(entity =>
        {
            entity.Property(variant => variant.Size).HasMaxLength(30).IsRequired();
            entity.Property(variant => variant.Color).HasMaxLength(50).IsRequired();
            entity.Property(variant => variant.OverridePrice).HasPrecision(18, 2);
            entity.HasOne(variant => variant.Product)
                .WithMany(product => product.Variants)
                .HasForeignKey(variant => variant.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.Property(image => image.Url).HasMaxLength(500).IsRequired();
            entity.HasOne(image => image.Product)
                .WithMany(product => product.Images)
                .HasForeignKey(image => image.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
