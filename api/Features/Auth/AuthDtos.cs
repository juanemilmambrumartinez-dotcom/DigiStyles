using System.ComponentModel.DataAnnotations;

namespace DigiStyles.Api.Features.Auth;

public sealed record RegisterRequest(
    [property: Required, EmailAddress, StringLength(256)] string? Email,
    [property: Required, StringLength(128, MinimumLength = 8)] string? Password,
    [property: Required, StringLength(100, MinimumLength = 1)] string? Name);

public sealed record LoginRequest(
    [property: Required, EmailAddress, StringLength(256)] string? Email,
    [property: Required, StringLength(128)] string? Password);

public sealed record RefreshRequest([property: Required, StringLength(200)] string? RefreshToken);

public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAtUtc,
    UserResponse User);

public sealed record UserResponse(string Email, string Name, IReadOnlyCollection<string> Roles);