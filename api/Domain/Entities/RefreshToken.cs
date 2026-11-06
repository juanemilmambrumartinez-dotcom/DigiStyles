namespace DigiStyles.Api.Domain.Entities;

public sealed class RefreshToken
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public required byte[] TokenHash { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public byte[]? ReplacedByTokenHash { get; set; }
}