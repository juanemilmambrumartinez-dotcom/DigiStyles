using Microsoft.EntityFrameworkCore;

namespace DigiStyles.Api.Infrastructure.Data;

/// <summary>
/// Contexto principal de acceso a datos de DigiStyles, administrado por EF Core.
/// </summary>
public sealed class DigiStylesDbContext(DbContextOptions<DigiStylesDbContext> options)
    : DbContext(options)
{
}
