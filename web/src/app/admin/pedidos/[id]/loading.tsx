export default function AdminOrderLoading() {
  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div aria-hidden="true" className="grid min-w-0 gap-5 animate-pulse">
        <div className="h-10 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
        <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
        <div className="h-48 border-[var(--brand-border-width)] border-foreground bg-surface" />
        <div className="h-40 border-[var(--brand-border-width)] border-foreground bg-surface" />
      </div>
    </main>
  );
}