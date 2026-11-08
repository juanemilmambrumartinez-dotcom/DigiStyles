import Link from "next/link";
import { cookies } from "next/headers";
import { brand } from "@/config/brand.config";
import { currencyCookieName, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { CurrencySelector } from "@/components/catalog/CurrencySelector";
import { BrandLogo } from "@/components/BrandLogo";
import { CartShell } from "@/components/cart/CartShell";
import { SessionHeaderControl } from "@/components/session/SessionHeaderControl";

export async function SiteHeader() {
  const cookieStore = await cookies();
  const savedCurrency = cookieStore.get(currencyCookieName)?.value;
  const currency: CurrencyCode = isCurrencyCode(savedCurrency)
    ? savedCurrency
    : brand.monedaPredeterminada;

  return (
    <header className="liquid-glass sticky top-0 z-[200] border-x-0 border-t-0 px-3 py-3 sm:px-6">
      <div className="relative z-[201] mx-auto flex min-w-0 max-w-7xl flex-wrap items-center justify-between gap-2 sm:gap-3">
        <Link href="/" className="flex shrink-0 items-center text-xl font-black uppercase text-foreground" aria-label={brand.nombre}>
          <BrandLogo logo={brand.logo} fallbackText={brand.nombre} />
        </Link>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-5" aria-label="Principal">
          <Link href="/productos" className="whitespace-nowrap text-sm font-bold uppercase text-foreground hover:text-accent">
            Productos
          </Link>
          <SessionHeaderControl />
          <CurrencySelector value={currency} />
          <CartShell currency={currency} />
        </nav>
      </div>
    </header>
  );
}
