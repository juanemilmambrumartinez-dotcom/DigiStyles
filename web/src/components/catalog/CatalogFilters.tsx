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
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input name="search" defaultValue={initial.search} placeholder="Buscar" aria-label="Buscar" className="rounded border border-white/15 bg-background px-3 py-2" />
      <input name="category" defaultValue={initial.category} placeholder="Categoría" aria-label="Categoría" className="rounded border border-white/15 bg-background px-3 py-2" />
      <input name="size" defaultValue={initial.size} placeholder="Talla" aria-label="Talla" className="rounded border border-white/15 bg-background px-3 py-2" />
      <input name="minPrice" defaultValue={initial.minDisplayPrice} inputMode="decimal" placeholder={`Mín. ${brand.monedas[currency].simbolo}`} aria-label="Precio mínimo" className="rounded border border-white/15 bg-background px-3 py-2" />
      <div className="flex gap-2">
        <input name="maxPrice" defaultValue={initial.maxDisplayPrice} inputMode="decimal" placeholder={`Máx. ${brand.monedas[currency].simbolo}`} aria-label="Precio máximo" className="min-w-0 flex-1 rounded border border-white/15 bg-background px-3 py-2" />
        <button className="rounded bg-accent px-4 py-2 font-bold text-black" type="submit">Filtrar</button>
      </div>
    </form>
  );
}
