import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOrderDetailView } from "@/components/admin/AdminOrderDetailView";

export const metadata: Metadata = {
  title: "Pedido | Administración | DigiStyles",
  robots: { index: false, follow: false },
};

function AdminOrderPageSkeleton() {
  return <div aria-hidden="true" className="h-[38rem] animate-pulse border-[var(--brand-border-width)] border-foreground bg-surface opacity-60" />;
}

export default function AdminOrderPage() {
  return (
    <main id="contenido" className="mx-auto grid min-w-0 w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <Suspense fallback={<AdminOrderPageSkeleton />}>
        <AdminOrderDetailView />
      </Suspense>
    </main>
  );
}