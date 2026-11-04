"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/catalog/ProductImage";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice, type CurrencyCode } from "@/lib/currency";

type CartViewProps = {
  currency: CurrencyCode;
};

const validationDelayMs = 280;

export function CartView({ currency }: CartViewProps) {
  const {
    lines,
    setQuantity,
    removeItem,
    hydrated,
    notice,
    validate,
    validation,
    validationError,
    validating,
  } = useCart();
  const [validatedSignature, setValidatedSignature] = useState<string | null>(null);
  const validationRunRef = useRef(0);
  const linesSignature = lines.map((line) => `${line.variantId}:${line.quantity}`).join("|");
  const hasLines = lines.length > 0;

  const runValidation = useCallback((signature: string) => {
    const runId = validationRunRef.current + 1;
    validationRunRef.current = runId;
    setValidatedSignature(null);

    void validate().then(() => {
      if (runId === validationRunRef.current) setValidatedSignature(signature);
    });
  }, [validate]);

  useEffect(() => {
    if (!hydrated) return;

    const runId = validationRunRef.current + 1;
    validationRunRef.current = runId;

    if (!hasLines) return;

    const timer = window.setTimeout(() => {
      if (runId !== validationRunRef.current) return;
      runValidation(linesSignature);
    }, validationDelayMs);

    return () => window.clearTimeout(timer);
  }, [hydrated, hasLines, linesSignature, runValidation]);

  const isCurrentValidation = hasLines
    && validatedSignature === linesSignature
    && !validating;
  const isUpdating = hasLines && !isCurrentValidation;
  const responseLines = validation?.lines ?? [];
  const totalIsDefinitive = isCurrentValidation && Boolean(validation) && !validationError;

  if (!hydrated) {
    return (
      <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-8 sm:px-6">
        <p aria-live="polite" className="detail-mono border-[var(--brand-border-width)] border-foreground bg-surface p-4 uppercase">Cargando carrito...</p>
      </main>
    );
  }

  if (!hasLines) {
    return (
      <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="border-b-[var(--brand-border-width)] border-foreground pb-5">
          <p className="detail-mono text-sm uppercase text-foreground">Tu selección</p>
          <h1 className="mt-2 text-5xl leading-none sm:text-7xl">Carrito</h1>
        </header>
        <section className="brutal-card mt-8 bg-surface p-6 sm:p-10" aria-labelledby="carrito-vacio">
          <h2 id="carrito-vacio" className="text-3xl">Tu carrito está vacío</h2>
          <p className="mt-3 max-w-xl text-foreground-soft">Explora la colección y añade tus piezas favoritas.</p>
          <Link href="/productos" className="t-button mt-6 inline-flex bg-accent px-5 py-3 font-bold uppercase text-background">Ver productos</Link>
        </section>
      </main>
    );
  }

  return (
    <main id="contenido" className="mx-auto min-w-0 w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="border-b-[var(--brand-border-width)] border-foreground pb-5">
        <p className="detail-mono text-sm uppercase text-foreground">Tu selección / <span className="count-badge">{lines.length}</span></p>
        <h1 className="mt-2 text-5xl leading-none sm:text-7xl">Carrito</h1>
      </header>

      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
        <section className="min-w-0" aria-labelledby="lineas-carrito">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="lineas-carrito" className="text-3xl">Líneas</h2>
            <p aria-live="polite" className="detail-mono text-sm uppercase text-foreground-soft">{isUpdating ? "Actualizando..." : `${lines.length} ${lines.length === 1 ? "línea" : "líneas"}`}</p>
          </div>

          {notice && <p role="status" aria-live="polite" className="mt-4 border-[var(--brand-border-width)] border-accent bg-surface p-3 text-sm">{notice}</p>}

          <ul className="mt-5 grid min-w-0 gap-5">
            {lines.map((storedLine) => {
              const responseLine = responseLines.find((line) => line.variantId === storedLine.variantId);
              const name = responseLine?.productName ?? `Variante ${storedLine.variantId}`;
              const quantity = storedLine.quantity;
              const status = responseLine?.status;
              const acceptedQuantity = responseLine?.acceptedQuantity ?? 0;
              const canAdjust = status === "stock_insuficiente" && acceptedQuantity > 0;
              const canRemove = status === "sin_stock" || status === "no_disponible";

              return (
                <li key={storedLine.variantId} className="brutal-card grid min-w-0 gap-4 bg-surface p-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:p-5">
                  <div className="relative aspect-square min-w-0 border-[var(--brand-border-width)] border-foreground bg-background">
                    <ProductImage
                      src={responseLine?.imageUrl}
                      name={name}
                      category="producto"
                      color={responseLine?.color ?? undefined}
                      sizes="(max-width: 640px) calc(100vw - 2rem), 7rem"
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-2xl">{name}</h3>
                      <p className="detail-mono mt-1 break-words text-sm text-foreground-soft">
                        {responseLine ? [responseLine.size, responseLine.color].filter(Boolean).join(" / ") || "Variante" : "Cargando detalles..."}
                      </p>
                    </div>

                    {responseLine?.message && <p role={status === "ok" ? "status" : "alert"} className="border-l-4 border-accent pl-3 text-sm">{responseLine.message}</p>}

                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2" aria-label={`Cantidad de ${name}`}>
                        <button
                          type="button"
                          className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-xl leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          aria-label={quantity === 1 ? `Quitar ${name}` : `Reducir cantidad de ${name}`}
                          onClick={() => quantity === 1 ? removeItem(storedLine.variantId) : setQuantity(storedLine.variantId, quantity - 1)}
                        >-</button>
                        <span className="detail-mono min-w-8 text-center" aria-live="polite">{quantity}</span>
                        <button
                          type="button"
                          className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-xl leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          aria-label={`Aumentar cantidad de ${name}`}
                          disabled={quantity >= 10}
                          onClick={() => setQuantity(storedLine.variantId, quantity + 1)}
                        >+</button>
                      </div>
                      <div className="detail-mono text-right">
                        {responseLine?.unitPrice != null && <p>{formatPrice(responseLine.unitPrice, currency)} / ud.</p>}
                        {responseLine && <p className="font-bold">{formatPrice(responseLine.lineSubtotal, currency)}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {canAdjust && (
                        <button type="button" className="t-button bg-accent px-3 py-2 text-sm font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setQuantity(storedLine.variantId, acceptedQuantity)}>
                          Ajustar a {acceptedQuantity}
                        </button>
                      )}
                      {canRemove && (
                        <button type="button" className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-sm font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Quitar ${name}`} onClick={() => removeItem(storedLine.variantId)}>
                          Quitar
                        </button>
                      )}
                      {!canRemove && (
                        <button type="button" className="border-b-[var(--brand-border-width)] border-foreground px-0 py-2 text-sm font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Quitar ${name}`} onClick={() => removeItem(storedLine.variantId)}>
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-labelledby="resumen-carrito">
          <div className="brutal-card bg-surface p-5 sm:p-6">
            <h2 id="resumen-carrito" className="text-3xl">Resumen</h2>
            <p className="mt-5 border-t-[var(--brand-border-width)] border-foreground pt-4 text-sm text-foreground-soft">Los precios se muestran en la moneda elegida; el cobro real se definirá en el pago.</p>
            <div aria-live="polite" className="mt-6 flex items-end justify-between gap-4 border-t-[var(--brand-border-width)] border-foreground pt-4">
              <span className="detail-mono text-sm uppercase">Total</span>
              <span className="detail-mono text-2xl font-bold">{totalIsDefinitive && validation ? formatPrice(validation.total, currency) : "Actualizando..."}</span>
            </div>
            <button type="button" disabled className="t-button mt-6 w-full cursor-not-allowed bg-accent px-4 py-3 font-bold uppercase text-background opacity-60">Disponible en el pago</button>
          </div>

          {validationError && !isUpdating && (
            <div role="alert" className="mt-5 border-[var(--brand-border-width)] border-accent bg-surface p-4">
              <p>{validationError}</p>
              <button type="button" className="t-button mt-4 bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => runValidation(linesSignature)}>Reintentar</button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}