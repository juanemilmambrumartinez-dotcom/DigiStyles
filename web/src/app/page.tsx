import { brand } from "@/config/brand.config";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-xl border-l-2 border-accent pl-6">
        <p className="mb-3 text-sm font-semibold uppercase text-accent">
          {brand.textos.estado}
        </p>
        <h1 className="text-5xl font-black text-white sm:text-7xl">
          {brand.nombre}
        </h1>
        <p className="mt-4 text-xl text-foreground-soft">{brand.eslogan}</p>
        <p className="mt-8 max-w-md text-sm leading-6 text-foreground-soft">
          {brand.textos.descripcion}
        </p>
      </section>
    </main>
  );
}
