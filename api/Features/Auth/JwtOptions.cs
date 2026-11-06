namespace DigiStyles.Api.Features.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string? Key { get; set; }
    public string Issuer { get; set; } = "DigiStyles.Api";
    public string Audience { get; set; } = "DigiStyles.Web";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
    public int RefreshReuseGraceSeconds { get; set; } = 10;
}