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
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2">
      <div className="aspect-square rounded-lg bg-white/5" role="img" aria-label={`Imagen de ${product.name}`} />
      <section>
        <p className="text-sm uppercase text-accent">{product.brand}</p>
        <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
        <p className="mt-4 text-foreground-soft">{product.description}</p>
        <p className="mt-6 text-3xl font-bold">{formatPrice(product.basePrice, currency)}</p>
        <h2 className="mt-8 font-semibold">Variantes</h2>
        <div className="mt-3 grid gap-2">
          {product.variants.map((variant) => <div key={variant.id} className="flex justify-between rounded border border-white/10 p-3"><span>{variant.size} · {variant.color}</span><span>{variant.stock > 0 ? `${variant.stock} disponibles` : "Agotado"}</span></div>)}
        </div>
      </section>
    </main>
  );
}
