import type { Metadata } from "next";
import { AccountView } from "@/components/session/AccountView";

export const metadata: Metadata = {
  title: "Cuenta | DigiStyles",
  robots: { index: false, follow: false },
};

export default function CuentaPage() {
  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="brutal-card bg-surface p-5 sm:p-8">
        <AccountView />
      </section>
    </main>
  );
}
