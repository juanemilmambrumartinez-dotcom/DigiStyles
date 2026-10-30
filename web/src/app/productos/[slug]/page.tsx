import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand.config";
import { currencyCookieName, formatPrice, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { fetchCatalog, type ProductDetail } from "@/lib/catalog-api";

export const instant = false;

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const saved = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(saved) ? saved : brand.monedaPredeterminada;
  let product: ProductDetail;
  try {
    const response = await fetchCatalog(`/api/products/${encodeURIComponent(slug)}`);
    if (response.status === 404) notFound();
    product = await response.json();
  } catch (error) {
    if ((error as { digest?: string }).digest?.includes("NEXT_NOT_FOUND")) throw error;
    return <main className="mx-auto max-w-5xl px-4 py-10"><p role="alert">No se pudo cargar el producto. Verifica que el API esté ejecutándose.</p></main>;
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2">
      <div className="brutal-card aspect-square bg-surface" role="img" aria-label={`Imagen de ${product.name}`} />
      <section>
        <p className="detail-mono text-sm uppercase text-foreground">{product.brand}</p>
        <h1 className="mt-2 text-5xl leading-none sm:text-7xl">{product.name}</h1>
        <p className="mt-5 max-w-xl text-foreground-soft">{product.description}</p>
        <p key={currency} className="price-value detail-mono mt-6 border-y-[var(--brand-border-width)] border-foreground py-4 text-4xl font-bold">{formatPrice(product.basePrice, currency)}</p>
        <h2 className="mt-8 text-2xl">Variantes</h2>
        <div className="mt-3 grid gap-3">
          {product.variants.map((variant) => <div key={variant.id} className="detail-mono flex justify-between border-[var(--brand-border-width)] border-foreground bg-surface p-3"><span>{variant.size} / {variant.color}</span><span>{variant.stock > 0 ? `${variant.stock} disponibles` : "Agotado"}</span></div>)}
        </div>
      </section>
    </main>
  );
}
