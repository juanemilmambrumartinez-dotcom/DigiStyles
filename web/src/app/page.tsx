import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand.config";

export default function Home() {
  const title = brand.nombre.toUpperCase();
  const titleParts = [title.slice(0, 4), title.slice(4)];
  const marqueeItems = Array.from({ length: 8 }, (_, index) => (
    <span key={index} className="flex shrink-0 items-center gap-5 px-5 detail-mono text-sm uppercase">
      STREETWEAR <span aria-hidden="true">·</span> ROPA <span aria-hidden="true">·</span> TENIS <span aria-hidden="true">·</span> ACCESORIOS
    </span>
  ));

  return (
    <main id="contenido" className="overflow-hidden">
      <section className="relative z-0 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-12">
        <div className="hero-copy min-w-0 max-w-5xl lg:pr-4">
          <p className="detail-mono mb-5 text-sm uppercase text-foreground">{brand.textos.estado}</p>
          <h1 aria-label={brand.nombre} className="hero-title w-full max-w-full leading-[0.82]">
            {titleParts.map((part, partIndex) => (
              <span key={part} className={partIndex === 0 ? "text-foreground" : "text-accent"}>
                {Array.from(part).map((letter, letterIndex) => (
                  <span
                    key={`${part}-${letterIndex}`}
                    aria-hidden="true"
                    className="hero-letter"
                    style={{ "--letter-index": partIndex * part.length + letterIndex } as React.CSSProperties}
                  >
                    {letter}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <div className="mt-8 flex max-w-xl flex-col gap-5 border-l-[var(--brand-border-width)] border-accent pl-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xl uppercase sm:text-2xl">{brand.eslogan}</p>
            <Link href="/productos" className="brutal-card t-button inline-flex w-fit bg-accent px-5 py-3 font-black uppercase text-background">
              Ver colección
            </Link>
          </div>
        </div>
        <div className="brutal-card relative mx-auto aspect-[4/5] w-full max-w-[32rem] bg-surface">
          <div className="relative h-full w-full overflow-hidden bg-surface">
            <Image
              src="/placeholders/placeholder-tenis.svg"
              alt="Tenis de la colección DigiStyles"
              fill
              priority
              sizes="(max-width: 1024px) calc(100vw - 2rem), 32rem"
              className="object-contain p-5"
            />
            <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1 detail-mono text-sm uppercase">
              <span className="border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-1 text-foreground">Tenis</span>
              <span className="border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-1 text-foreground">Drop / 01</span>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-y-[var(--brand-border-width)] border-foreground bg-accent py-3 text-background" aria-hidden="true">
        <div className="marquee-track">{marqueeItems}{marqueeItems}</div>
      </div>
    </main>
  );
}
