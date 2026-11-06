using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;

namespace DigiStyles.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");

        group.MapPost("/register", async (RegisterRequest? request, AuthService auth, CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateRegister(request);
            if (validationErrors.Count > 0) return Results.ValidationProblem(validationErrors);

            var result = await auth.RegisterAsync(request!, cancellationToken);
            return result.Succeeded
                ? Results.Ok(result.Response)
                : Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = result.Errors });
        }).RequireRateLimiting("AuthRegister");

        group.MapPost("/login", async (LoginRequest? request, AuthService auth, CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateLogin(request);
            if (validationErrors.Count > 0) return Results.ValidationProblem(validationErrors);

            var response = await auth.LoginAsync(request!, cancellationToken);
            return response is null
                ? Results.Json(new { message = "Correo o contraseña incorrectos." }, statusCode: StatusCodes.Status401Unauthorized)
                : Results.Ok(response);
        }).RequireRateLimiting("AuthLogin");

        group.MapPost("/refresh", async (RefreshRequest? request, AuthService auth, CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateRefresh(request);
            if (validationErrors.Count > 0) return Results.ValidationProblem(validationErrors);

            var response = await auth.RefreshAsync(request!.RefreshToken!, cancellationToken);
            return response is null
                ? Results.Json(new { message = "El refresh token no es válido." }, statusCode: StatusCodes.Status401Unauthorized)
                : Results.Ok(response);
        }).RequireRateLimiting("AuthRefresh");

        group.MapPost("/logout", async (RefreshRequest? request, AuthService auth, CancellationToken cancellationToken) =>
        {
            var validationErrors = ValidateRefresh(request);
            if (validationErrors.Count > 0) return Results.ValidationProblem(validationErrors);

            await auth.RevokeAsync(request!.RefreshToken!, cancellationToken);
            return Results.NoContent();
        }).RequireRateLimiting("AuthLogout");

        group.MapGet("/me", [Authorize] async (HttpContext httpContext, AuthService auth) =>
        {
            var response = await auth.GetUserAsync(httpContext.User);
            return response is null ? Results.Unauthorized() : Results.Ok(response);
        });

        return endpoints;
    }

    private static Dictionary<string, string[]> ValidateRegister(RegisterRequest? request)
    {
        var errors = ValidateLogin(request is null ? null : new LoginRequest(request.Email, request.Password));
        if (request?.Password is not null && request.Password.Length < 8)
            errors["password"] = ["La contraseña debe tener al menos 8 caracteres."];
        if (string.IsNullOrWhiteSpace(request?.Name) || request.Name != request.Name.Trim() || request.Name.Length > 100)
            errors["name"] = ["El nombre debe tener entre 1 y 100 caracteres y no tener espacios extremos."];
        return errors;
    }

    private static Dictionary<string, string[]> ValidateLogin(LoginRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request?.Email))
            errors["email"] = ["El correo es obligatorio."];
        else if (request.Email.Length > 256)
            errors["email"] = ["El correo no puede superar los 256 caracteres."];
        else if (!new EmailAddressAttribute().IsValid(request.Email))
            errors["email"] = ["El correo no tiene un formato válido."];

        if (string.IsNullOrWhiteSpace(request?.Password))
            errors["password"] = ["La contraseña es obligatoria."];
        else if (request.Password.Length > 128)
            errors["password"] = ["La contraseña no puede superar los 128 caracteres."];
        return errors;
    }

    private static Dictionary<string, string[]> ValidateRefresh(RefreshRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request?.RefreshToken))
            errors["refreshToken"] = ["El refresh token es obligatorio."];
        else if (request.RefreshToken.Length > 200)
            errors["refreshToken"] = ["El refresh token no puede superar los 200 caracteres."];
        return errors;
    }
}