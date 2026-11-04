import { cookies } from "next/headers";
import { Suspense } from "react";
import { CartView } from "@/components/cart/CartView";
import { brand } from "@/config/brand.config";
import { currencyCookieName, isCurrencyCode, type CurrencyCode } from "@/lib/currency";

export const instant = false;

async function CartPageContent() {
  const cookieStore = await cookies();
  const saved = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(saved) ? saved : brand.monedaPredeterminada;

  return <CartView currency={currency} />;
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-8 sm:px-6">
        <p aria-live="polite" className="detail-mono border-[var(--brand-border-width)] border-foreground bg-surface p-4 uppercase">Cargando carrito...</p>
      </main>
    }>
      <CartPageContent />
    </Suspense>
  );
}