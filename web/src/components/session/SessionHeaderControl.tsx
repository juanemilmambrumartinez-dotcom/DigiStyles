"use client";

import Link from "next/link";
import { useSession } from "@/components/session/SessionProvider";

export function SessionHeaderControl() {
  const { usuario, estado } = useSession();

  if (estado === "cargando") {
    return <span aria-hidden="true" className="h-8 w-16 shrink-0 border-[var(--brand-border-width)] border-transparent sm:w-24" />;
  }

  if (estado === "autenticado" && usuario) {
    return (
      <Link href="/cuenta" className="block max-w-24 truncate whitespace-nowrap text-sm font-bold uppercase text-foreground hover:text-accent sm:max-w-36" title={usuario.name}>
        {usuario.name}
      </Link>
    );
  }

  if (estado === "anonimo" || estado === "error") {
    return <Link href="/ingresar" className="whitespace-nowrap text-sm font-bold uppercase text-foreground hover:text-accent">Ingresar</Link>;
  }

  return <span aria-hidden="true" className="h-8 w-16 shrink-0 border-[var(--brand-border-width)] border-transparent sm:w-24" />;
}