"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session/SessionProvider";

function AccountSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-5 animate-pulse">
      <div className="h-10 w-48 border-[var(--brand-border-width)] border-foreground bg-background" />
      <div className="h-[4.5rem] w-full border-[var(--brand-border-width)] border-foreground bg-background" />
      <div className="h-[4.5rem] w-full border-[var(--brand-border-width)] border-foreground bg-background" />
      <div className="h-12 w-full border-[var(--brand-border-width)] border-foreground bg-background" />
    </div>
  );
}
export function AccountView() {
  const router = useRouter();
  const { usuario, estado, cerrarSesión } = useSession();
  const [cerrando, setCerrando] = useState(false);

    useEffect(() => {
    if (estado === "anonimo" && !cerrando) {
      router.replace(`/ingresar?next=${encodeURIComponent("/cuenta")}`);
    }
  }, [estado, cerrando, router]);

   async function handleLogout() {
    if (cerrando) return;
    setCerrando(true);
    try {
      await cerrarSesión();
      router.replace("/");
    } catch {
      setCerrando(false);
    }
  }

  if (estado === "cargando" || estado === "anonimo") {
    return <AccountSkeleton />;
  }

  if (estado === "error") {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Tu cuenta</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
          No pudimos verificar tu sesión. Inténtalo de nuevo.
        </div>
        <button
          type="button"
          className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!usuario) {
    return <AccountSkeleton />;
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl sm:text-5xl">Tu cuenta</h1>
      <div className="grid min-h-12 content-center border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-3">
        <span className="detail-mono text-xs font-bold uppercase text-foreground-soft">Nombre</span>
        <span>{usuario.name}</span>
      </div>
      <div className="grid min-h-12 content-center border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-3">
        <span className="detail-mono text-xs font-bold uppercase text-foreground-soft">Correo</span>
        <span className="break-all">{usuario.email}</span>
      </div>
      <Link
        className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/pedidos"
      >
        Mis pedidos
      </Link>
      <button
        type="button"
        className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => { void handleLogout(); }}
        disabled={cerrando}
      >
        {cerrando ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
    </div>
  );
}
