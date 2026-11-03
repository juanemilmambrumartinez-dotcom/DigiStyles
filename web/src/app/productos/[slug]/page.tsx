import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand.config";
import { ProductImage } from "@/components/catalog/ProductImage";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
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
    return <main id="contenido" className="mx-auto max-w-5xl px-4 py-10"><p role="alert">No se pudo cargar el producto. Verifica que el API esté ejecutándose.</p></main>;
  }

  return (
    <main id="contenido" className="mx-auto grid min-w-0 max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-1">
        {product.images.length > 0 ? product.images.map((image, index) => (
          <div key={image.url} className="brutal-card relative aspect-square overflow-hidden bg-surface">
            <ProductImage
              src={image.url}
              name={product.name}
              category={product.category}
              color={product.variants[0]?.color}
              priority={index === 0}
              sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 768px) 50vw, 50vw"
            />
          </div>
        )) : (
          <div className="brutal-card relative aspect-square overflow-hidden bg-surface">
            <ProductImage
              name={product.name}
              category={product.category}
              color={product.variants[0]?.color}
              sizes="(max-width: 768px) calc(100vw - 2rem), 50vw"
            />
          </div>
        )}
      </div>
      <section>
        <p className="detail-mono text-sm uppercase text-foreground">{product.brand}</p>
        <h1 className="mt-2 break-words text-5xl leading-none sm:text-7xl">{product.name}</h1>
        <p className="mt-5 max-w-xl text-foreground-soft">{product.description}</p>
        <p key={currency} className="price-value detail-mono mt-6 border-y-[var(--brand-border-width)] border-foreground py-4 text-4xl font-bold">{formatPrice(product.basePrice, currency)}</p>
        <h2 className="mt-8 text-2xl">Variantes</h2>
        <div className="mt-3 grid gap-3">
          {product.variants.map((variant) => <div key={variant.id} className="detail-mono flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 border-[var(--brand-border-width)] border-foreground bg-surface p-3"><span className="min-w-0">{variant.size} / {variant.color}</span><span className="shrink-0">{variant.stock > 0 ? `${variant.stock} disponibles` : "Sin stock"}</span></div>)}
        </div>
        <AddToCartButton variants={product.variants} />
      </section>
    </main>
  );
}
