using System.Security.Cryptography;
using System.Text.Json;
using DigiStyles.Api.Domain.Entities;
using DigiStyles.Api.Features.Cart;
using DigiStyles.Api.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DigiStyles.Api.Features.Orders;

public sealed class OrderService(
    DigiStylesDbContext db,
    CartPricingService pricingService,
    IOptions<ShippingOptions> shippingOptions,
    IOptions<OrderOptions> orderOptions)
{
    private const string OrderNumberAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public async Task<OrderCreateResult> CreateAsync(
        string userId,
        string idempotencyKey,
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var requestHash = ComputeRequestHash(request);
        var existing = await FindByIdempotencyKeyAsync(userId, idempotencyKey, cancellationToken);
        if (existing is not null)
            return MatchesHash(existing, requestHash)
                ? OrderCreateResult.Idempotent(existing)
                : OrderCreateResult.ReusedKey();

        var pendingCount = await db.Set<Order>().CountAsync(order =>
            order.UserId == userId && order.Status == OrderStatus.Pendiente, cancellationToken);
        if (pendingCount >= orderOptions.Value.MaxPendingOrdersPerUser)
            return OrderCreateResult.TooManyPending();

        var pricing = await pricingService.PriceAsync(request.Lines);
        if (pricing.Error is not null)
            return OrderCreateResult.InvalidCart(pricing.Error.Value);

        if (pricing.Lines.Any(line => line.Status != CartLineStatus.Ok))
            return OrderCreateResult.StockUnavailable(ToStockLines(pricing.Lines));

        var subtotal = pricing.Lines.Sum(line => line.LineSubtotal);
        var shipping = shippingOptions.Value.FixedCost;
        var total = subtotal + shipping;
        if (total != request.ExpectedTotal)
            return OrderCreateResult.PriceChanged(total);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                var result = await TryCreateOrderAsync(
                    userId, idempotencyKey, requestHash, request, pricing.Lines,
                    subtotal, shipping, total, cancellationToken);
                if (result.FailedVariantId is int failedVariantId)
                    return OrderCreateResult.StockUnavailable(ToStockLines(pricing.Lines, failedVariantId));

                if (result.LockUnavailable)
                    return OrderCreateResult.Retry();

                if (result.TooManyPending)
                    return OrderCreateResult.TooManyPending();

                return OrderCreateResult.Created(result.Order!);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception))
            {
                db.ChangeTracker.Clear();
                existing = await FindByIdempotencyKeyAsync(userId, idempotencyKey, cancellationToken);
                if (existing is not null)
                    return MatchesHash(existing, requestHash)
                        ? OrderCreateResult.Idempotent(existing)
                        : OrderCreateResult.ReusedKey();
            }
        }

        throw new InvalidOperationException("No se pudo generar un número de pedido único.");
    }

    private async Task<OrderAttemptResult> TryCreateOrderAsync(
        string userId,
        string idempotencyKey,
        byte[] requestHash,
        CreateOrderRequest request,
        IReadOnlyList<CartPricingLine> lines,
        decimal subtotal,
        decimal shipping,
        decimal total,
        CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var lockResult = await AcquireUserOrderLockAsync(userId, transaction.GetDbTransaction(), cancellationToken);
        if (lockResult < 0)
            return OrderAttemptResult.LockUnavailableResult;

        var pendingCount = await db.Set<Order>().CountAsync(order =>
            order.UserId == userId && order.Status == OrderStatus.Pendiente, cancellationToken);
        if (pendingCount >= orderOptions.Value.MaxPendingOrdersPerUser)
            return OrderAttemptResult.TooManyPendingResult;

        foreach (var line in lines.OrderBy(line => line.VariantId))
        {
            var affected = await db.ProductVariants
                .Where(variant => variant.Id == line.VariantId && variant.Stock >= line.RequestedQuantity)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    variant => variant.Stock, variant => variant.Stock - line.RequestedQuantity), cancellationToken);
            if (affected == 0)
                return new OrderAttemptResult(null, line.VariantId);
        }

        var now = DateTime.UtcNow;
        var order = new Order
        {
            OrderNumber = GenerateOrderNumber(),
            UserId = userId,
            Status = OrderStatus.Pendiente,
            PaymentMethod = request.PaymentMethod == "transferencia"
                ? PaymentMethod.Transferencia
                : PaymentMethod.ContraEntrega,
            Currency = "DOP",
            Subtotal = subtotal,
            ShippingCost = shipping,
            Total = total,
            ContactName = request.Contact.Name,
            Phone = request.Contact.Phone,
            Address = request.Contact.Address,
            City = request.Contact.City,
            Note = request.Contact.Note,
            IdempotencyKey = idempotencyKey,
            RequestHash = requestHash,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Items = lines.OrderBy(line => line.VariantId).Select(line => new OrderItem
            {
                ProductVariantId = line.VariantId,
                ProductName = line.ProductName!,
                Size = line.Size!,
                Color = line.Color!,
                UnitPrice = line.UnitPrice!.Value,
                Quantity = line.RequestedQuantity,
                LineTotal = line.LineSubtotal
            }).ToList()
        };

        db.Set<Order>().Add(order);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new OrderAttemptResult(order, null);
    }

    private async Task<int> AcquireUserOrderLockAsync(
        string userId, System.Data.Common.DbTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            EXEC @LockResult = sys.sp_getapplock
                @Resource = @ResourceName,
                @LockOwner = @LockOwnerName,
                @LockMode = @LockModeName,
                @LockTimeout = @LockTimeoutValue;
            """;

        var returnParameter = command.CreateParameter();
        returnParameter.ParameterName = "@LockResult";
        returnParameter.DbType = System.Data.DbType.Int32;
        returnParameter.Direction = System.Data.ParameterDirection.ReturnValue;
        command.Parameters.Add(returnParameter);

        AddParameter(command, "@ResourceName", $"orders:{userId}");
        AddParameter(command, "@LockOwnerName", "Transaction");
        AddParameter(command, "@LockModeName", "Exclusive");
        AddParameter(command, "@LockTimeoutValue", 5000);

        await command.ExecuteNonQueryAsync(cancellationToken);
        return (int)(returnParameter.Value ?? -999);
    }

    private static void AddParameter(System.Data.Common.DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private Task<Order?> FindByIdempotencyKeyAsync(
        string userId, string idempotencyKey, CancellationToken cancellationToken) =>
        db.Set<Order>().AsNoTracking().Include(order => order.Items)
            .SingleOrDefaultAsync(order => order.UserId == userId && order.IdempotencyKey == idempotencyKey,
                cancellationToken);

    private static bool MatchesHash(Order order, byte[] requestHash) =>
        CryptographicOperations.FixedTimeEquals(order.RequestHash, requestHash);

    private static byte[] ComputeRequestHash(CreateOrderRequest request)
    {
        var normalizedLines = request.Lines
            .GroupBy(line => line.VariantId)
            .OrderBy(group => group.Key)
            .Select(group => new { VariantId = group.Key, Quantity = group.Sum(line => line.Quantity) })
            .ToArray();
        var normalized = new
        {
            Lines = normalizedLines,
            request.PaymentMethod,
            Contact = new
            {
                request.Contact.Name,
                request.Contact.Phone,
                request.Contact.Address,
                request.Contact.City,
                request.Contact.Note
            },
            request.ExpectedTotal
        };
        return SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(normalized));
    }

    private static string GenerateOrderNumber()
    {
        Span<char> suffix = stackalloc char[8];
        Span<byte> random = stackalloc byte[8];
        RandomNumberGenerator.Fill(random);
        for (var index = 0; index < suffix.Length; index++)
            suffix[index] = OrderNumberAlphabet[random[index] % OrderNumberAlphabet.Length];
        return $"DS-{new string(suffix)}";
    }

    private static bool IsUniqueViolation(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException sqlException && sqlException.Errors.Cast<SqlError>()
                .Any(error => error.Number is 2601 or 2627))
                return true;
        }

        return false;
    }

    private static IReadOnlyList<OrderStockLineResponse> ToStockLines(
        IReadOnlyList<CartPricingLine> lines, int? failedVariantId = null) =>
        lines.Select(line =>
        {
            var status = failedVariantId == line.VariantId
                ? "stock_insuficiente"
                : line.Status switch
                {
                    CartLineStatus.Ok => "ok",
                    CartLineStatus.InsufficientStock => "stock_insuficiente",
                    CartLineStatus.OutOfStock => "sin_stock",
                    CartLineStatus.Unavailable => "no_disponible",
                    _ => "no_disponible"
                };
            var message = status switch
            {
                "ok" => "La línea está disponible.",
                "stock_insuficiente" => "La cantidad solicitada ya no está disponible.",
                "sin_stock" => "La variante no tiene stock disponible.",
                _ => "La variante no existe o el producto no está disponible."
            };
            return new OrderStockLineResponse(line.VariantId, status, message);
        }).ToList();
}

public sealed record OrderCreateResult(
    OrderCreateOutcome Outcome,
    Order? Order,
    CartValidationError? CartError,
    IReadOnlyList<OrderStockLineResponse>? StockLines,
    decimal? NewTotal,
    bool LockUnavailable = false,
    bool TooManyPending = false)
{
    public static OrderCreateResult Created(Order order) => new(OrderCreateOutcome.Created, order, null, null, null);
    public static OrderCreateResult Idempotent(Order order) => new(OrderCreateOutcome.Idempotent, order, null, null, null);
    public static OrderCreateResult ReusedKey() => new(OrderCreateOutcome.ReusedKey, null, null, null, null);
    public static OrderCreateResult TooManyPending() => new(OrderCreateOutcome.TooManyPending, null, null, null, null);
    public static OrderCreateResult Retry() => new(OrderCreateOutcome.Retry, null, null, null, null, true);
    public static OrderCreateResult InvalidCart(CartValidationError error) => new(OrderCreateOutcome.InvalidCart, null, error, null, null);
    public static OrderCreateResult StockUnavailable(IReadOnlyList<OrderStockLineResponse> lines) => new(OrderCreateOutcome.StockUnavailable, null, null, lines, null);
    public static OrderCreateResult PriceChanged(decimal total) => new(OrderCreateOutcome.PriceChanged, null, null, null, total);
}

public enum OrderCreateOutcome
{
    Created,
    Idempotent,
    ReusedKey,
    TooManyPending,
    InvalidCart,
    StockUnavailable,
    PriceChanged,
    Retry
}

public sealed record OrderAttemptResult(Order? Order, int? FailedVariantId,
    bool LockUnavailable = false, bool TooManyPending = false)
{
    public static OrderAttemptResult LockUnavailableResult => new(null, null, true);
    public static OrderAttemptResult TooManyPendingResult => new(null, null, false, true);
}