using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DigiStyles.Api.Domain.Entities;
using DigiStyles.Api.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DigiStyles.Api.Features.Auth;

public sealed class AuthService(
    UserManager<ApplicationUser> userManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    DigiStylesDbContext db,
    IOptions<JwtOptions> jwtOptions)
{
    private static readonly string DummyPasswordHash = new PasswordHasher<ApplicationUser>()
        .HashPassword(new ApplicationUser { Name = "usuario" }, "contraseña-ficticia");

    private JwtOptions Jwt => jwtOptions.Value;

    public async Task<(bool Succeeded, string[] Errors, AuthResponse? Response)> RegisterAsync(
        RegisterRequest request, CancellationToken cancellationToken)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email!,
            Email = request.Email!,
            Name = request.Name!
        };
        var result = await userManager.CreateAsync(user, request.Password!);
        if (!result.Succeeded)
        {
            return (false, result.Errors.Select(error => MapError(error.Code)).ToArray(), null);
        }

        result = await userManager.AddToRoleAsync(user, "cliente");
        if (!result.Succeeded)
        {
            await userManager.DeleteAsync(user);
            return (false, ["No se pudo crear el usuario."], null);
        }

        return (true, [], await IssueTokensAsync(user, cancellationToken));
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email!);
        if (user is null)
        {
            passwordHasher.VerifyHashedPassword(new ApplicationUser { Name = "usuario" }, DummyPasswordHash, request.Password!);
            return null;
        }

        if (await userManager.IsLockedOutAsync(user))
        {
            passwordHasher.VerifyHashedPassword(new ApplicationUser { Name = "usuario" }, DummyPasswordHash, request.Password!);
            return null;
        }

        if (!await userManager.CheckPasswordAsync(user, request.Password!))
        {
            await userManager.AccessFailedAsync(user);
            return null;
        }

        await userManager.ResetAccessFailedCountAsync(user);
        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthResponse?> RefreshAsync(string rawToken, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var hash = HashToken(rawToken);
        var stored = await db.RefreshTokens.AsNoTracking().Include(token => token.User)
            .SingleOrDefaultAsync(token => token.TokenHash == hash, cancellationToken);
        if (stored is null) return null;
        if (await userManager.IsLockedOutAsync(stored.User)) return null;

        if (stored.RevokedAtUtc is null && stored.ExpiresAtUtc > now)
        {
            var (replacement, rawReplacementToken) = CreateRefreshToken(stored.UserId, now);
            var rotationSucceeded = false;
            await using (var transaction = await db.Database.BeginTransactionAsync(cancellationToken))
            {
                var affected = await db.RefreshTokens
                    .Where(token => token.Id == stored.Id &&
                        token.RevokedAtUtc == null &&
                        token.ExpiresAtUtc > now)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(token => token.RevokedAtUtc, now)
                        .SetProperty(token => token.ReplacedByTokenHash, replacement.TokenHash), cancellationToken);

                if (affected == 1)
                {
                    db.RefreshTokens.Add(replacement);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    rotationSucceeded = true;
                }
            }

            if (rotationSucceeded)
                return await CreateAuthResponseAsync(stored.User, replacement, rawReplacementToken, cancellationToken);
        }

        stored = await db.RefreshTokens.AsNoTracking().Include(token => token.User)
            .SingleOrDefaultAsync(token => token.TokenHash == hash, cancellationToken);
        if (stored is null || stored.ExpiresAtUtc <= now) return null;
        if (await userManager.IsLockedOutAsync(stored.User)) return null;

        if (stored.RevokedAtUtc is null) return null;
        if (stored.RevokedAtUtc > now.AddSeconds(-Jwt.RefreshReuseGraceSeconds)) return null;

        await using var reuseTransaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.RefreshTokens
            .Where(token => token.UserId == stored.UserId &&
                token.RevokedAtUtc == null &&
                token.ExpiresAtUtc > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.RevokedAtUtc, now), cancellationToken);
        await reuseTransaction.CommitAsync(cancellationToken);

        return null;
    }

    public async Task RevokeAsync(string rawToken, CancellationToken cancellationToken)
    {
        var hash = HashToken(rawToken);
        var stored = await db.RefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == hash, cancellationToken);
        if (stored is null || stored.RevokedAtUtc is not null) return;

        stored.RevokedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserResponse?> GetUserAsync(ClaimsPrincipal principal)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return null;

        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return null;

        return new UserResponse(user.Email!, user.Name, (await userManager.GetRolesAsync(user)).ToArray());
    }

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var (refreshToken, rawRefreshToken) = CreateRefreshToken(user.Id, now);
        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync(cancellationToken);
        return await CreateAuthResponseAsync(user, refreshToken, rawRefreshToken, cancellationToken);
    }

    private async Task<AuthResponse> CreateAuthResponseAsync(
        ApplicationUser user, RefreshToken refreshToken, string rawRefreshToken, CancellationToken cancellationToken)
    {
        var roles = await userManager.GetRolesAsync(user);
        var expiresAt = DateTime.UtcNow.AddMinutes(Jwt.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(ClaimTypes.Name, user.Name)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Jwt.Key!)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: Jwt.Issuer,
            audience: Jwt.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token),
            rawRefreshToken, expiresAt,
            new UserResponse(user.Email!, user.Name, roles.ToArray()));
    }

    private (RefreshToken Entity, string RawToken) CreateRefreshToken(string userId, DateTime now)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        return (new RefreshToken
        {
            UserId = userId,
            TokenHash = HashToken(rawToken),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddDays(Jwt.RefreshTokenDays)
        }, rawToken);
    }

    private static byte[] HashToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    private static string MapError(string code) => code switch
    {
        "DuplicateUserName" or "DuplicateEmail" => "El correo ya está registrado.",
        "InvalidEmail" => "El correo no tiene un formato válido.",
        "PasswordTooShort" => "La contraseña debe tener al menos 8 caracteres.",
        _ => "No se pudo crear el usuario."
    };
}