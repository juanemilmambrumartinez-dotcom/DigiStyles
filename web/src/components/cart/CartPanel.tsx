"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useCartValidation } from "@/components/cart/useCartValidation";
import { formatPrice, type CurrencyCode } from "@/lib/currency";

type CartPanelProps = {
  currency: CurrencyCode;
  open: boolean;
  openerRef: RefObject<HTMLAnchorElement | null>;
  onClose: () => void;
};

function useNativeScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlScrollbarGutter: html.style.scrollbarGutter,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "stable";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.scrollbarGutter = previous.htmlScrollbarGutter;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [open]);
}

export function CartPanel({ currency, open, openerRef, onClose }: CartPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useNativeScrollLock(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, [open]);

  useEffect(() => () => {
    dialogRef.current?.close();
    openerRef.current?.focus();
  }, [openerRef]);

  useEffect(() => {
    if (!open) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [onClose, open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])",
    ) ?? []);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeAndRestoreFocus() {
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  return (
    <dialog
      ref={dialogRef}
      className="cart-panel-dialog fixed inset-0 z-[230] m-0 h-full max-h-none w-full max-w-none bg-transparent p-0"
      aria-labelledby="cart-panel-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        closeAndRestoreFocus();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAndRestoreFocus();
      }}
      onKeyDown={handleKeyDown}
    >
      <aside className={`cart-panel t-panel liquid-glass ml-auto flex h-full w-full max-w-[28rem] flex-col p-4 sm:p-6 ${open ? "is-open" : ""}`}>
        <header className="flex items-start justify-between gap-4 border-b-[var(--brand-border-width)] border-foreground pb-4">
          <div>
            <p className="detail-mono text-xs uppercase text-foreground-soft">Tu selección</p>
            <h2 id="cart-panel-title" className="mt-1 text-3xl">Carrito</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-xl leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Cerrar carrito"
            onClick={closeAndRestoreFocus}
          >
            ×
          </button>
        </header>

        {open && <CartPanelContent currency={currency} onClose={closeAndRestoreFocus} />}
      </aside>
    </dialog>
  );
}

function CartPanelContent({ currency, onClose }: { currency: CurrencyCode; onClose: () => void }) {
  const {
    lines,
    setQuantity,
    removeItem,
    hydrated,
    notice,
    validation,
    validationError,
    validating,
  } = useCart();
  const {
    linesSignature,
    validatedSignature,
    runValidation,
  } = useCartValidation({ enabled: hydrated });
  const responseLines = validation?.lines ?? [];
  const hasLines = lines.length > 0;
  const isCurrentValidation = hasLines
    && validatedSignature === linesSignature
    && !validating;
  const isUpdating = hasLines && !isCurrentValidation;
  const totalIsDefinitive = isCurrentValidation && Boolean(validation) && !validationError;

  if (!hydrated) {
    return <p aria-live="polite" className="mt-5 border-[var(--brand-border-width)] border-foreground bg-surface p-3 text-sm uppercase">Cargando carrito...</p>;
  }

  if (!hasLines) {
    return (
      <div className="mt-5 bg-surface p-4">
        <p className="text-xl uppercase">Tu carrito está vacío</p>
        <Link href="/productos" className="t-button mt-5 inline-flex bg-accent px-4 py-3 text-sm font-bold uppercase text-background" onClick={onClose}>Ver productos</Link>
      </div>
    );
  }

  return (
    <>
      {notice && <p role="status" aria-live="polite" className="mt-4 border-[var(--brand-border-width)] border-accent bg-surface p-3 text-sm">{notice}</p>}
      <ul className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {lines.map((storedLine) => {
          const responseLine = responseLines.find((line) => line.variantId === storedLine.variantId);
          const name = responseLine?.productName ?? `Variante ${storedLine.variantId}`;
          const quantity = storedLine.quantity;
          const status = responseLine?.status;
          const acceptedQuantity = responseLine?.acceptedQuantity ?? 0;
          const canAdjust = status === "stock_insuficiente" && acceptedQuantity > 0;
          const canRemove = status === "sin_stock" || status === "no_disponible";

          return (
            <li key={storedLine.variantId} className="brutal-card min-w-0 bg-surface p-3">
              <div className="min-w-0">
                <h3 className="break-words text-xl">{name}</h3>
                <p className="detail-mono mt-1 break-words text-xs text-foreground-soft">
                  {responseLine ? [responseLine.size, responseLine.color].filter(Boolean).join(" / ") || "Variante" : "Cargando detalles..."}
                </p>
              </div>
              {responseLine?.message && <p role={status === "ok" ? "status" : "alert"} className="mt-3 border-l-4 border-accent pl-2 text-xs">{responseLine.message}</p>}
              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2" aria-label={`Cantidad de ${name}`}>
                  <button
                    type="button"
                    className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={quantity === 1 ? `Quitar ${name}` : `Reducir cantidad de ${name}`}
                    onClick={() => quantity === 1 ? removeItem(storedLine.variantId) : setQuantity(storedLine.variantId, quantity - 1)}
                  >-</button>
                  <span className="detail-mono min-w-7 text-center" aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={`Aumentar cantidad de ${name}`}
                    disabled={quantity >= 10}
                    onClick={() => setQuantity(storedLine.variantId, quantity + 1)}
                  >+</button>
                </div>
                <div className="detail-mono text-right text-sm">
                  {responseLine?.unitPrice != null && <p>{formatPrice(responseLine.unitPrice, currency)} / ud.</p>}
                  {responseLine && <p className="font-bold">{formatPrice(responseLine.lineSubtotal, currency)}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {canAdjust && (
                  <button type="button" className="t-button bg-accent px-3 py-2 text-xs font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setQuantity(storedLine.variantId, acceptedQuantity)}>
                    Ajustar a {acceptedQuantity}
                  </button>
                )}
                <button type="button" className={canRemove ? "t-button border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-xs font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" : "border-b-[var(--brand-border-width)] border-foreground px-0 py-2 text-xs font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"} aria-label={`Quitar ${name}`} onClick={() => removeItem(storedLine.variantId)}>
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="mt-5 border-t-[var(--brand-border-width)] border-foreground pt-4">
        <p className="text-xs text-foreground-soft">Los precios se muestran en la moneda elegida; el cobro real se definirá en el pago.</p>
        <div aria-live="polite" className="mt-4 flex items-end justify-between gap-4">
          <span className="detail-mono text-sm uppercase">Total</span>
          <span className="detail-mono text-xl font-bold">{totalIsDefinitive && validation ? formatPrice(validation.total, currency) : "Actualizando..."}</span>
        </div>
        {validationError && !isUpdating && (
          <div role="alert" className="mt-4 border-[var(--brand-border-width)] border-accent bg-surface p-3 text-sm">
            <p>{validationError}</p>
            <button type="button" className="t-button mt-3 bg-accent px-3 py-2 text-xs font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => runValidation(linesSignature)}>Reintentar</button>
          </div>
        )}
        <Link href="/carrito" className="t-button mt-5 inline-flex w-full justify-center bg-accent px-4 py-3 text-sm font-bold uppercase text-background" onClick={onClose}>Ver carrito completo</Link>
      </footer>
    </>
  );
}