import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailView } from "@/components/OrderDetailView";

export const metadata: Metadata = {
  title: "Pedido | DigiStyles",
  robots: { index: false, follow: false },
};

function OrderPageSkeleton() {
  return <div aria-hidden="true" className="h-[38rem] animate-pulse border-[var(--brand-border-width)] border-foreground bg-surface opacity-60" />;
}

export default function OrderPage() {
  return (
    <main id="contenido" className="mx-auto grid min-w-0 w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <Suspense fallback={<OrderPageSkeleton />}>
        <OrderDetailView />
      </Suspense>
    </main>
  );
}