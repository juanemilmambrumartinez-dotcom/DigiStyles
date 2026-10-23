import Link from "next/link";
import { cookies } from "next/headers";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
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
    return <main className="mx-auto max-w-6xl px-4 py-10"><p role="alert">No se pudo cargar el catálogo. Verifica que el API esté ejecutándose.</p></main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm text-accent">Colección</p><h1 className="text-3xl font-bold">Productos</h1></div>
      </div>
      <CatalogFilters currency={currency} initial={{ ...normalized, minDisplayPrice: normalized.minPrice ? String(convertFromBase(Number(normalized.minPrice), currency)) : "", maxDisplayPrice: normalized.maxPrice ? String(convertFromBase(Number(normalized.maxPrice), currency)) : "" }} />
      {data.items.length === 0 ? <p className="py-12 text-center text-foreground-soft">No hay productos que coincidan con los filtros.</p> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((product) => (
            <Link key={product.id} href={`/productos/${product.slug}`} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
              <div className="aspect-square bg-white/5" />
              <div className="p-4"><p className="text-xs uppercase text-foreground-soft">{product.brand}</p><h2 className="mt-1 font-semibold">{product.name}</h2><p className="mt-3 text-lg font-bold text-accent">{formatPrice(product.price, currency)}</p></div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
