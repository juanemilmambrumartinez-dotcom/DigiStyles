import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { AdminOrdersList } from "@/components/admin/AdminOrdersList";

export const metadata: Metadata = {
  title: "Administración de pedidos | DigiStyles",
  robots: { index: false, follow: false },
};

function AdminOrdersFallback() {
  return (
    <div aria-hidden="true" className="grid gap-5 animate-pulse">
      <div className="h-12 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <main id="contenido" className="mx-auto grid min-w-0 w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <DemoNotice />
      <Suspense fallback={<AdminOrdersFallback />}>
        <AdminOrdersList />
      </Suspense>
    </main>
  );
}