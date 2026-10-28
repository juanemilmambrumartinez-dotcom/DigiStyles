import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand.config";

export default function Home() {
  const marqueeItems = Array.from({ length: 8 }, (_, index) => (
    <span key={index} className="flex shrink-0 items-center gap-5 px-5 detail-mono text-sm uppercase">
      Nueva temporada <span className="text-accent">{"///"}</span>
    </span>
  ));

  return (
    <main className="overflow-hidden">
      <section className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)]">
        <div className="min-w-0 max-w-5xl">
          <p className="detail-mono mb-5 text-sm uppercase text-accent">{brand.textos.estado}</p>
          <h1 className="w-full max-w-full text-[clamp(3.5rem,10vw,8.5rem)] leading-[0.78]">
            {brand.nombre}
          </h1>
          <div className="mt-8 flex max-w-xl flex-col gap-5 border-l-[var(--brand-border-width)] border-accent pl-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xl uppercase sm:text-2xl">{brand.eslogan}</p>
            <Link href="/productos" className="brutal-card inline-flex w-fit bg-accent px-5 py-3 font-black uppercase text-background">
              Ver colección
            </Link>
          </div>
        </div>
        <div className="brutal-card relative aspect-[4/5] w-full overflow-hidden bg-[var(--brand-surface)]">
          <Image
            src="/placeholders/catalog-tenis.svg"
            alt="Tenis de la colección DigiStyles"
            fill
            priority
            sizes="(max-width: 1024px) calc(100vw - 2rem), 32rem"
            className="object-contain p-5"
          />
          <span className="liquid-glass detail-mono absolute bottom-3 left-3 px-3 py-2 text-sm uppercase text-foreground">Drop / 01</span>
        </div>
      </section>

      <div className="overflow-hidden border-y-[var(--brand-border-width)] border-foreground bg-accent py-3 text-background" aria-hidden="true">
        <div className="marquee-track">{marqueeItems}{marqueeItems}</div>
      </div>
    </main>
  );
}
