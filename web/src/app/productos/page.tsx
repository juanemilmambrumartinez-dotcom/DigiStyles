import Link from "next/link";
import { cookies } from "next/headers";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { ProductImage } from "@/components/catalog/ProductImage";
import { brand } from "@/config/brand.config";
import { currencyCookieName, formatPrice, isCurrencyCode, convertFromBase, type CurrencyCode } from "@/lib/currency";
import { fetchCatalog, type ProductPageResponse } from "@/lib/catalog-api";

export const instant = false;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const saved = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(saved) ? saved : brand.monedaPredeterminada;
  const normalized = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] ?? "" : value ?? ""]));
  const apiParams = new URLSearchParams();
  ["category", "size", "search", "page"].forEach((key) => { if (normalized[key]) apiParams.set(key, normalized[key]); });
  if (normalized.minPrice) apiParams.set("minPrice", normalized.minPrice);
  if (normalized.maxPrice) apiParams.set("maxPrice", normalized.maxPrice);

  let data: ProductPageResponse;
  try {
    const response = await fetchCatalog(`/api/products?${apiParams}`);
    data = await response.json();
  } catch {
    return <main id="contenido" className="mx-auto max-w-6xl px-4 py-10"><p role="alert">No se pudo cargar el catálogo. Verifica que el API esté ejecutándose.</p></main>;
  }

  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 border-b-[var(--brand-border-width)] border-foreground pb-5">
        <p className="detail-mono text-sm uppercase text-foreground">Colección / <span className="count-badge">{data.items.length}</span></p>
        <h1 className="mt-2 text-5xl leading-none sm:text-7xl">Productos</h1>
      </div>
      <CatalogFilters currency={currency} initial={{ ...normalized, minDisplayPrice: normalized.minPrice ? String(convertFromBase(Number(normalized.minPrice), currency)) : "", maxDisplayPrice: normalized.maxPrice ? String(convertFromBase(Number(normalized.maxPrice), currency)) : "" }} />
      {data.items.length === 0 ? <p className="py-12 text-center text-foreground-soft">No hay productos que coincidan con los filtros.</p> : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((product) => (
            <Link key={product.id} href={`/productos/${product.slug}`} className="brutal-card group overflow-hidden bg-surface">
              <div className="relative aspect-square border-b-[var(--brand-border-width)] border-foreground bg-background">
                <ProductImage
                  src={product.imageUrl}
                  name={product.name}
                  category={product.category}
                  sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 33vw"
                />
                <span key={currency} className="price-value liquid-glass detail-mono absolute bottom-3 right-3 px-3 py-2 text-sm text-foreground">{formatPrice(product.price, currency)}</span>
              </div>
              <div className="p-4"><p className="detail-mono text-xs uppercase text-foreground-soft">{product.brand}</p><h2 className="mt-2 text-2xl group-hover:text-accent">{product.name}</h2></div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
