import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/session/LoginForm";

export const metadata: Metadata = {
  title: "Ingresar | DigiStyles",
  robots: { index: false, follow: false },
};

function AuthFallback() {
  return <div aria-hidden="true" className="mt-8 h-64 animate-pulse border-[var(--brand-border-width)] border-foreground bg-surface opacity-60" />;
}

export default function IngresarPage() {
  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="brutal-card bg-surface p-5 sm:p-8">
        <p className="detail-mono text-sm font-bold uppercase text-accent">Acceso</p>
        <h1 className="mt-3 text-3xl sm:text-5xl">Ingresa a tu cuenta</h1>
        <Suspense fallback={<AuthFallback />}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}