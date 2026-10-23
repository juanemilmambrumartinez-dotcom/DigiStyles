"use client";

import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { currencyCookieName, type CurrencyCode } from "@/lib/currency";

export function CurrencySelector({ value }: { value: CurrencyCode }) {
  const router = useRouter();

  function changeCurrency(currency: CurrencyCode) {
    document.cookie = `${currencyCookieName}=${currency}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-foreground-soft">
      <span>Moneda</span>
      <select
        aria-label="Seleccionar moneda"
        className="rounded border border-white/15 bg-background px-2 py-1.5 text-foreground"
        value={value}
        onChange={(event) => changeCurrency(event.target.value as CurrencyCode)}
      >
        {Object.entries(brand.monedas).map(([code, currency]) => (
          <option key={code} value={code}>{currency.codigo} {currency.simbolo}</option>
        ))}
      </select>
    </label>
  );
}
