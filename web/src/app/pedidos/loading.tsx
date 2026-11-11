export default function OrdersLoading() {
  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div aria-hidden="true" className="grid gap-5 animate-pulse">
        <div className="h-12 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
        <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
        <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
      </div>
    </main>
  );
}