import type { Metadata } from "next";
import { OrdersList } from "@/components/OrdersList";
import { DemoNotice } from "@/components/DemoNotice";

export const metadata: Metadata = {
  title: "Mis pedidos | DigiStyles",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <main id="contenido" className="mx-auto grid min-w-0 w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <DemoNotice />
      <OrdersList />
    </main>
  );
}