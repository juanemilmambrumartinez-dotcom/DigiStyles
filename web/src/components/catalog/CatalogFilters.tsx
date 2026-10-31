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
    <form onSubmit={submit} className="t-panel is-open liquid-glass grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="min-w-0"> <span className="mb-1 block text-sm font-bold uppercase">Buscar</span><input name="search" defaultValue={initial.search} placeholder="Buscar" className="min-w-0 w-full border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 outline-none focus:border-accent" /></label>
      <input name="category" defaultValue={initial.category} placeholder="Categoría" aria-label="Categoría" className="border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 outline-none focus:border-accent" />
      <input name="size" defaultValue={initial.size} placeholder="Talla" aria-label="Talla" className="detail-mono border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 outline-none focus:border-accent" />
      <label className="min-w-0"><span className="mb-1 block text-sm font-bold uppercase">Precio mínimo</span><input name="minPrice" defaultValue={initial.minDisplayPrice} inputMode="decimal" placeholder={`Mín. ${brand.monedas[currency].simbolo}`} className="detail-mono min-w-0 w-full border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 outline-none focus:border-accent" /></label>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-32"><span className="mb-1 block text-sm font-bold uppercase">Precio máximo</span><input name="maxPrice" defaultValue={initial.maxDisplayPrice} inputMode="decimal" placeholder={`Máx. ${brand.monedas[currency].simbolo}`} className="detail-mono min-w-0 w-full border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 outline-none focus:border-accent" /></label>
        <button className="brutal-card t-button shrink-0 bg-accent px-4 py-2 font-black uppercase text-background" type="submit">Filtrar</button>
      </div>
    </form>
  );
}
