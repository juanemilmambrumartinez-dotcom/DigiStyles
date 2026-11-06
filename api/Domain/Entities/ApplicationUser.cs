using Microsoft.AspNetCore.Identity;

namespace DigiStyles.Api.Domain.Entities;

public sealed class ApplicationUser : IdentityUser
{
    public required string Name { get; set; }
}