import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { brand } from "@/config/brand.config";
import { currencyCookieName, isCurrencyCode, type CurrencyCode } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Checkout | DigiStyles",
  robots: { index: false, follow: false },
};

async function CheckoutPageContent() {
  const cookieStore = await cookies();
  const saved = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(saved) ? saved : brand.monedaPredeterminada;

  return <CheckoutForm currency={currency} />;
}

function CheckoutSkeleton() {
  return <div aria-hidden="true" className="h-[42rem] animate-pulse border-[var(--brand-border-width)] border-foreground bg-surface opacity-60" />;
}

export default function CheckoutPage() {
  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutPageContent />
      </Suspense>
    </main>
  );
}
