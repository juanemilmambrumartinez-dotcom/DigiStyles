import Image from "next/image";
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
    <header className="glass-layer sticky top-0 z-[100] border-x-0 border-t-0 px-4 py-3 sm:px-6">
      <div className="relative z-[101] mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center text-xl font-black uppercase text-foreground" aria-label={brand.nombre}>
          <Image
            src={brand.logo.src}
            alt={brand.logo.alt}
            width={brand.logo.width}
            height={brand.logo.height}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-5" aria-label="Principal">
          <Link href="/productos" className="text-sm font-bold uppercase text-foreground hover:text-accent">
            Productos
          </Link>
          <CurrencySelector value={currency} />
        </nav>
      </div>
    </header>
  );
}
