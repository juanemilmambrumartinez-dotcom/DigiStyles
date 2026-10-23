# DigiStyles

Tienda web de ropa, tenis y accesorios construida con Next.js y ASP.NET Core.

## Estado

La Fase 2 implementa el catálogo completo.

## Ejecutar localmente

### API

```powershell
dotnet run --project api/DigiStyles.Api.csproj --launch-profile http
```

API: `http://localhost:5008`

La base de datos local es SQL Server `DigiStylesDev`. La migración se aplicó con EF Core y el seed de desarrollo crea 12 productos.

### Web

```powershell
npm run dev --prefix web
```

Web: `http://localhost:3000`

Copiar `web/.env.local.example` a `web/.env.local` si no existe.

## Catálogo

- `/productos`
- `/productos/[slug]`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/{slug}`

Los precios se almacenan en DOP. Las tasas DOP, USD y EUR están en `web/src/config/brand.config.ts` y deben actualizarse manualmente.

## Calidad

```powershell
dotnet build api/DigiStyles.Api.csproj
npm run lint --prefix web
npm run build --prefix web
```
