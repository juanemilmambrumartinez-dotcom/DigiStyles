using System.Security.Claims;
using System.Text.Json;
using DigiStyles.Api.Domain.Entities;
using DigiStyles.Api.Features.Cart;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DigiStyles.Api.Features.Orders;

public static class OrderEndpoints
{
    private const int MaxRequestBodyBytes = 16 * 1024;

    public static void MapOrderEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/orders", async (HttpContext httpContext, OrderService orderService,
            CancellationToken cancellationToken) =>
        {
            var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
                return Results.Unauthorized();
            return Results.Ok(await orderService.GetRecentAsync(userId, cancellationToken));
        })
        .RequireAuthorization()
        .RequireRateLimiting("OrdersRead");

        routes.MapGet("/api/orders/{id:guid}", async (Guid id, HttpContext httpContext,
            OrderService orderService, IOptions<BankTransferOptions> bankTransferOptions,
            CancellationToken cancellationToken) =>
        {
            var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
                return Results.Unauthorized();

            var order = await orderService.GetByIdAsync(userId, id, cancellationToken);
            return order is null
                ? Results.NotFound(new OrderErrorResponse("pedido_no_encontrado", "El pedido no existe."))
                : Results.Ok(ToResponse(order, bankTransferOptions.Value, true));
        })
        .RequireAuthorization()
        .RequireRateLimiting("OrdersRead");

        routes.MapPost("/api/orders/{id:guid}/cancel", async (Guid id, HttpContext httpContext,
            OrderService orderService, IOptions<BankTransferOptions> bankTransferOptions,
            CancellationToken cancellationToken) =>
        {
            var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
                return Results.Unauthorized();

            var result = await orderService.CancelAsync(userId, id, cancellationToken);
            return result.Outcome switch
            {
                OrderCancelOutcome.NotFound => Results.NotFound(new OrderErrorResponse(
                    "pedido_no_encontrado", "El pedido no existe.")),
                OrderCancelOutcome.AlreadyCancelled => Results.Ok(ToResponse(
                    result.Order!, bankTransferOptions.Value, true)),
                OrderCancelOutcome.NotCancelable => Results.Conflict(new OrderErrorResponse(
                    "no_cancelable", "El pedido ya no se puede cancelar.")),
                OrderCancelOutcome.Cancelled => Results.Ok(ToResponse(
                    result.Order!, bankTransferOptions.Value, true)),
                _ => throw new InvalidOperationException()
            };
        })
        .RequireAuthorization()
        .RequireRateLimiting("OrdersCancel");

        routes.MapPost("/api/orders", async (HttpContext httpContext, OrderService orderService,
            IOptions<BankTransferOptions> bankTransferOptions, CancellationToken cancellationToken) =>
        {
            if (!await BodyFitsLimitAsync(httpContext, cancellationToken))
                return Results.Json(new OrderErrorResponse(
                    "cuerpo_demasiado_grande", "El cuerpo de la solicitud no puede superar los 16 KB."),
                    statusCode: StatusCodes.Status413PayloadTooLarge);

            var idempotencyKey = httpContext.Request.Headers["Idempotency-Key"].ToString();
            if (!IsValidIdempotencyKey(idempotencyKey))
                return Results.BadRequest(new OrderErrorResponse(
                    "clave_invalida", "La cabecera Idempotency-Key debe tener entre 8 y 64 caracteres alfanuméricos o guiones."));

            CreateOrderRequest request;
            try
            {
                request = await ParseRequestAsync(httpContext, cancellationToken);
            }
            catch (InvalidOrderRequestException exception)
            {
                return Results.BadRequest(new OrderErrorResponse("solicitud_invalida", exception.Message));
            }
            catch (JsonException)
            {
                return Results.BadRequest(new OrderErrorResponse("solicitud_invalida", "El cuerpo debe ser un JSON válido."));
            }
            catch (FormatException)
            {
                return Results.BadRequest(new OrderErrorResponse("solicitud_invalida", "Uno de los campos numéricos no es válido."));
            }

            var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
                return Results.Unauthorized();

            var result = await orderService.CreateAsync(userId, idempotencyKey, request, cancellationToken);
            return result.Outcome switch
            {
                OrderCreateOutcome.Created => Results.Json(ToResponse(result.Order!, bankTransferOptions.Value), statusCode: StatusCodes.Status201Created),
                OrderCreateOutcome.Idempotent => Results.Ok(ToResponse(result.Order!, bankTransferOptions.Value)),
                OrderCreateOutcome.ReusedKey => Results.Conflict(new OrderErrorResponse(
                    "clave_reutilizada", "La clave de idempotencia ya se utilizó con un contenido diferente.")),
                OrderCreateOutcome.TooManyPending => Results.Conflict(new OrderErrorResponse(
                    "demasiados_pendientes", "Ya tienes demasiados pedidos pendientes.")),
                OrderCreateOutcome.Retry => Results.Conflict(new OrderErrorResponse(
                    "reintentar", "No se pudo reservar el pedido a tiempo; inténtalo de nuevo.")),
                OrderCreateOutcome.InvalidCart => Results.BadRequest(new OrderErrorResponse(
                    "carrito_invalido", CartErrorMessage(result.CartError!.Value))),
                OrderCreateOutcome.StockUnavailable => Results.Conflict(new OrderErrorResponse(
                    "stock_o_disponibilidad", "Una o más líneas ya no están disponibles.", result.StockLines)),
                OrderCreateOutcome.PriceChanged => Results.Conflict(new OrderErrorResponse(
                    "precio_cambiado", "El precio total cambió; revisa tu pedido.", new { total = result.NewTotal })),
                _ => throw new InvalidOperationException()
            };
        })
        .RequireAuthorization()
        .RequireRateLimiting("OrdersCreate");
    }

    private static async Task<CreateOrderRequest> ParseRequestAsync(
        HttpContext httpContext, CancellationToken cancellationToken)
    {
        using var document = await JsonDocument.ParseAsync(httpContext.Request.Body, cancellationToken: cancellationToken);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new InvalidOrderRequestException("El cuerpo debe ser un objeto JSON.");

        var linesElement = Required(root, "lines", JsonValueKind.Array);
        var lines = new List<CartLineRequest>();
        foreach (var lineElement in linesElement.EnumerateArray())
        {
            if (lineElement.ValueKind != JsonValueKind.Object)
                throw new InvalidOrderRequestException("Cada línea debe ser un objeto.");
            var variantId = Required(lineElement, "variantId", JsonValueKind.Number).GetInt32();
            var quantity = Required(lineElement, "quantity", JsonValueKind.Number).GetInt32();
            lines.Add(new CartLineRequest(variantId, quantity));
        }

        var paymentMethod = Required(root, "paymentMethod", JsonValueKind.String).GetString();
        if (paymentMethod is not ("transferencia" or "contra_entrega"))
            throw new InvalidOrderRequestException("paymentMethod debe ser transferencia o contra_entrega.");

        var contactElement = Required(root, "contact", JsonValueKind.Object);
        var contact = new OrderContactRequest(
            ReadTrimmed(contactElement, "name", 1, 100),
            ReadTrimmed(contactElement, "phone", 1, 20),
            ReadTrimmed(contactElement, "address", 1, 200),
            ReadTrimmed(contactElement, "city", 1, 100),
            ReadOptionalTrimmed(contactElement, "note", 300));

        var expectedTotalElement = Required(root, "expectedTotal", JsonValueKind.Number);
        if (!expectedTotalElement.TryGetDecimal(out var expectedTotal))
            throw new InvalidOrderRequestException("expectedTotal debe ser un decimal válido.");

        return new CreateOrderRequest(lines, paymentMethod!, contact, expectedTotal);
    }

    private static async Task<bool> BodyFitsLimitAsync(
        HttpContext httpContext, CancellationToken cancellationToken)
    {
        if (httpContext.Request.ContentLength > MaxRequestBodyBytes)
            return false;
        if (httpContext.Request.ContentLength is not null)
            return true;

        httpContext.Request.EnableBuffering();
        var buffer = new byte[4096];
        var totalBytes = 0;
        while (totalBytes <= MaxRequestBodyBytes)
        {
            var bytesRead = await httpContext.Request.Body.ReadAsync(buffer, cancellationToken);
            if (bytesRead == 0)
                break;
            totalBytes += bytesRead;
        }

        httpContext.Request.Body.Position = 0;
        return totalBytes <= MaxRequestBodyBytes;
    }

    private static JsonElement Required(JsonElement parent, string name, JsonValueKind kind)
    {
        if (!parent.TryGetProperty(name, out var property) || property.ValueKind != kind)
            throw new InvalidOrderRequestException($"El campo {name} es obligatorio y tiene un tipo inválido.");
        return property;
    }

    private static string ReadTrimmed(JsonElement parent, string name, int minLength, int maxLength)
    {
        var value = Required(parent, name, JsonValueKind.String).GetString()!.Trim();
        if (value.Length < minLength || value.Length > maxLength)
            throw new InvalidOrderRequestException($"El campo {name} debe tener entre {minLength} y {maxLength} caracteres.");
        return value;
    }

    private static string? ReadOptionalTrimmed(JsonElement parent, string name, int maxLength)
    {
        if (!parent.TryGetProperty(name, out var property)) return null;
        if (property.ValueKind == JsonValueKind.Null) return null;
        if (property.ValueKind != JsonValueKind.String)
            throw new InvalidOrderRequestException($"El campo {name} tiene un tipo inválido.");
        var value = property.GetString()!.Trim();
        if (value.Length > maxLength)
            throw new InvalidOrderRequestException($"El campo {name} no puede superar los {maxLength} caracteres.");
        return value.Length == 0 ? null : value;
    }

    private static bool IsValidIdempotencyKey(string value) =>
        value.Length is >= 8 and <= 64 && value.All(character =>
            character is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '-');

    private static string CartErrorMessage(CartValidationError error) => error switch
    {
        CartValidationError.Empty => "La lista de líneas del carrito no puede estar vacía.",
        CartValidationError.TooManyLines => "El carrito no puede contener más de 20 líneas.",
        CartValidationError.InvalidQuantity => "La cantidad de cada línea debe estar entre 1 y 10.",
        CartValidationError.AccumulatedQuantityTooHigh => "La cantidad acumulada de una variante no puede superar 10.",
        _ => "El carrito no es válido."
    };

    private static OrderResponse ToResponse(
        Order order, BankTransferOptions bankTransferOptions, bool pendingTransferOnly = false) =>
        new(order.Id, order.OrderNumber, OrderService.ToStatus(order.Status), OrderService.ToPaymentMethod(order.PaymentMethod), order.Currency, order.Subtotal, order.ShippingCost,
            order.Total, DateTime.SpecifyKind(order.CreatedAtUtc, DateTimeKind.Utc), order.Items.Select(item => new OrderItemResponse(
                item.ProductVariantId, item.ProductName, item.Size, item.Color,
                item.UnitPrice, item.Quantity, item.LineTotal)).ToList(),
            new OrderDeliveryResponse(order.ContactName, order.Phone, order.Address, order.City, order.Note),
            order.PaymentMethod == PaymentMethod.Transferencia &&
            (!pendingTransferOnly || order.Status == OrderStatus.Pendiente)
                ? new OrderBankTransferResponse(bankTransferOptions.BankName, bankTransferOptions.AccountHolder,
                    bankTransferOptions.AccountNumber, bankTransferOptions.AccountType, order.OrderNumber)
                : null);
}

public sealed class InvalidOrderRequestException(string message) : Exception(message);