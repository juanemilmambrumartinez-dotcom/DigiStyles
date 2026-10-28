"use client";

import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { convertToBase, type CurrencyCode } from "@/lib/currency";

export function CatalogFilters({ currency, initial }: { currency: CurrencyCode; initial: Record<string, string> }) {
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    ["category", "size", "search"].forEach((key) => {
      const value = String(data.get(key) ?? "").trim();
      if (value) params.set(key, value);
    });
    ["minPrice", "maxPrice"].forEach((key) => {
      const value = String(data.get(key) ?? "").trim();
      if (value) params.set(key, String(convertToBase(Number(value), currency)));
    });
    router.push(`/productos${params.size ? `?${params}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="glass-layer grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input name="search" defaultValue={initial.search} placeholder="Buscar" aria-label="Buscar" className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-2 outline-none focus:border-accent" />
      <input name="category" defaultValue={initial.category} placeholder="Categoría" aria-label="Categoría" className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-2 outline-none focus:border-accent" />
      <input name="size" defaultValue={initial.size} placeholder="Talla" aria-label="Talla" className="detail-mono border-[var(--brand-border-width)] border-foreground bg-background px-3 py-2 outline-none focus:border-accent" />
      <input name="minPrice" defaultValue={initial.minDisplayPrice} inputMode="decimal" placeholder={`Mín. ${brand.monedas[currency].simbolo}`} aria-label="Precio mínimo" className="detail-mono border-[var(--brand-border-width)] border-foreground bg-background px-3 py-2 outline-none focus:border-accent" />
      <div className="flex gap-2">
        <input name="maxPrice" defaultValue={initial.maxDisplayPrice} inputMode="decimal" placeholder={`Máx. ${brand.monedas[currency].simbolo}`} aria-label="Precio máximo" className="detail-mono min-w-0 flex-1 border-[var(--brand-border-width)] border-foreground bg-background px-3 py-2 outline-none focus:border-accent" />
        <button className="brutal-card bg-accent px-4 py-2 font-black uppercase text-background" type="submit">Filtrar</button>
      </div>
    </form>
  );
}
