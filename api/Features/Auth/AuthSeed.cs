using Microsoft.AspNetCore.Identity;

namespace DigiStyles.Api.Features.Auth;

public static class AuthSeed
{
    private static readonly string[] Roles = ["cliente", "admin"];

    public static async Task SeedRolesAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(role));
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException($"No se pudo crear el rol '{role}'.");
                }
            }
        }
    }
}