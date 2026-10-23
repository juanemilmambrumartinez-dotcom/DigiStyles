import Link from "next/link";
import { cookies } from "next/headers";
import { brand } from "@/config/brand.config";
import { currencyCookieName, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { CurrencySelector } from "@/components/catalog/CurrencySelector";

export async function SiteHeader() {
  const cookieStore = await cookies();
  const savedCurrency = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(savedCurrency)
    ? savedCurrency
    : brand.monedaPredeterminada;

  return (
    <header className="border-b border-white/10 bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="font-bold text-foreground">{brand.nombre}</Link>
        <nav className="flex flex-wrap items-center justify-end gap-3" aria-label="Principal">
          <Link href="/productos" className="text-sm text-foreground-soft hover:text-foreground">Productos</Link>
          <CurrencySelector value={currency} />
        </nav>
      </div>
    </header>
  );
}
