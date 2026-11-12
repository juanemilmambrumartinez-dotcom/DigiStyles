using System.Text.Json;
using DigiStyles.Api.Domain.Entities;
using Microsoft.AspNetCore.RateLimiting;

namespace DigiStyles.Api.Features.Orders;

public static class AdminOrderEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public static void MapAdminOrderEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/admin/orders", async (
            string? status, OrderService orderService, CancellationToken cancellationToken) =>
        {
            if (!TryParseFilterStatus(status, out var parsedStatus))
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El estado no es válido."));

            return Results.Ok(await orderService.GetAdminSummariesAsync(parsedStatus, cancellationToken));
        })
        .RequireAuthorization("AdminOnly")
        .RequireRateLimiting("AdminOrdersRead");

        routes.MapGet("/api/admin/orders/{id}", async (
            string id, OrderService orderService, CancellationToken cancellationToken) =>
        {
            if (!Guid.TryParse(id, out var orderId))
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El id del pedido debe ser un GUID válido."));

            var order = await orderService.GetAdminByIdAsync(orderId, cancellationToken);
            return order is null
                ? Results.NotFound(new OrderErrorResponse(
                    "pedido_no_encontrado", "El pedido no existe."))
                : Results.Ok(order);
        })
        .RequireAuthorization("AdminOnly")
        .RequireRateLimiting("AdminOrdersRead");

        routes.MapPost("/api/admin/orders/{id}/status", async (
            string id, HttpRequest request, OrderService orderService,
            CancellationToken cancellationToken) =>
        {
            if (!Guid.TryParse(id, out var orderId))
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El id del pedido debe ser un GUID válido."));

            if (request.ContentType is null ||
                !request.ContentType.StartsWith("application/json", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El Content-Type debe ser application/json."));

            AdminOrderStatusRequest? body;
            try
            {
                body = await JsonSerializer.DeserializeAsync<AdminOrderStatusRequest>(
                request.Body, JsonOptions, cancellationToken);
            }
            catch (JsonException)
            {
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El cuerpo debe ser un JSON válido."));
            }

            if (body is null || !TryParseTargetStatus(body.Status, out var targetStatus))
                return Results.BadRequest(new OrderErrorResponse(
                    "solicitud_invalida", "El estado no es válido."));

            var result = await orderService.ChangeAdminStatusAsync(
                orderId, targetStatus, cancellationToken);
            return result.Outcome switch
            {
                AdminOrderStatusOutcome.Updated => Results.Ok(result.Order),
                AdminOrderStatusOutcome.AlreadyInStatus => Results.Ok(result.Order),
                AdminOrderStatusOutcome.NotFound => Results.NotFound(new OrderErrorResponse(
                    "pedido_no_encontrado", "El pedido no existe.")),
                AdminOrderStatusOutcome.InvalidTransition => Results.Conflict(new OrderErrorResponse(
                    "transicion_invalida", "La transición de estado no está permitida.")),
                _ => throw new InvalidOperationException()
            };
        })
        .RequireAuthorization("AdminOnly")
        .RequireRateLimiting("AdminOrdersWrite");
    }

    private static bool TryParseFilterStatus(string? value, out OrderStatus? status)
    {
        status = value switch
        {
            null => null,
            "Pendiente" => OrderStatus.Pendiente,
            "Confirmado" => OrderStatus.Confirmado,
            "Enviado" => OrderStatus.Enviado,
            "Entregado" => OrderStatus.Entregado,
            "Cancelado" => OrderStatus.Cancelado,
            _ => null
        };
        return value is null || status is not null;
    }

    private static bool TryParseTargetStatus(string? value, out OrderStatus status)
    {
        status = value switch
        {
            "Pendiente" => OrderStatus.Pendiente,
            "Confirmado" => OrderStatus.Confirmado,
            "Enviado" => OrderStatus.Enviado,
            "Entregado" => OrderStatus.Entregado,
            "Cancelado" => OrderStatus.Cancelado,
            _ => default
        };
        return value is "Pendiente" or "Confirmado" or "Enviado" or "Entregado" or "Cancelado";
    }
}
