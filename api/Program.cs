using DigiStyles.Api.Domain.Entities;
using DigiStyles.Api.Features.Auth;
using DigiStyles.Api.Features.Catalog;
using DigiStyles.Api.Features.Cart;
using DigiStyles.Api.Infrastructure.Data;
using DigiStyles.Api.Infrastructure.Data.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<DigiStylesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(options => !string.IsNullOrWhiteSpace(options.Key) && Encoding.UTF8.GetByteCount(options.Key) >= 32,
        "La configuración Jwt:Key es obligatoria y debe tener al menos 32 bytes.")
    .ValidateOnStart();
builder.Services.AddOptions<InternalApiOptions>()
    .Bind(builder.Configuration.GetSection(InternalApiOptions.SectionName))
    .Validate(options => !string.IsNullOrWhiteSpace(options.Key) && Encoding.UTF8.GetByteCount(options.Key) >= 32,
        "La configuración InternalApi:Key es obligatoria y debe tener al menos 32 bytes.")
    .ValidateOnStart();
builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.AllowedForNewUsers = true;
        options.SignIn.RequireConfirmedEmail = false;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<DigiStylesDbContext>();
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key ?? string.Empty)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<AuthService>();
builder.Services.AddRateLimiter(options =>
{
    var internalApiKey = builder.Configuration["InternalApi:Key"];
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.HttpContext.Request.Path.StartsWithSegments("/api/auth"))
            context.HttpContext.Response.Headers.CacheControl = "no-store";
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Demasiadas solicitudes. Inténtalo de nuevo más tarde." }, cancellationToken);
    };
    AddAuthPolicy(options, "AuthLogin", 10, internalApiKey);
    AddAuthPolicy(options, "AuthRegister", 5, internalApiKey);
    AddAuthPolicy(options, "AuthRefresh", 30, internalApiKey);
    AddAuthPolicy(options, "AuthLogout", 30, internalApiKey);
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendLocal", policy => policy
        .WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<DigiStylesDbContext>();
    await db.Database.MigrateAsync();
    await CatalogSeed.SeedAsync(db);
}

using (var scope = app.Services.CreateScope())
{
    await AuthSeed.SeedRolesAsync(scope.ServiceProvider);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("FrontendLocal");
app.Use(async (httpContext, next) =>
{
    if (httpContext.Request.Path.StartsWithSegments("/api/auth"))
        httpContext.Response.Headers.CacheControl = "no-store";
    await next(httpContext);
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapCatalogEndpoints();
app.MapCartEndpoints();

app.Run();

static void AddAuthPolicy(RateLimiterOptions options, string policyName, int permitLimit, string? internalApiKey)
{
    options.AddPolicy(policyName, httpContext => RateLimitPartition.GetFixedWindowLimiter(
        $"{policyName}:{AuthRateLimit.GetClientIp(httpContext, internalApiKey)}",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
}
