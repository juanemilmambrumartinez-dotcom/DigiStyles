"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { MAX_CART_LINES, MAX_QUANTITY } from "@/lib/cart-storage";
import type { ProductVariant } from "@/lib/catalog-api";

interface AddToCartButtonProps {
  variants: ProductVariant[];
}

export function AddToCartButton({ variants }: AddToCartButtonProps) {
  const { addItem, hydrated, notice, lines } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    variants.find((variant) => variant.stock > 0)?.id ?? null,
  );
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!addedNotice) return;

    const noticeTimer = window.setTimeout(() => setAddedNotice(null), 2500);
    return () => window.clearTimeout(noticeTimer);
  }, [addedNotice]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || selectedVariantId === null) return;

    const existingLine = lines.find((line) => line.variantId === selectedVariantId);
    const blocked = existingLine
      ? existingLine.quantity >= MAX_QUANTITY
      : lines.length >= MAX_CART_LINES;

    addItem(selectedVariantId, 1);
    setAttempted(true);
    setAddedNotice(blocked ? null : "Añadido al carrito");
  }

  return (
    <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="product-variant">
        Talla y color
        <select
          id="product-variant"
          className="border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-3 text-foreground"
          value={selectedVariantId ?? ""}
          onChange={(event) => setSelectedVariantId(event.target.value ? Number(event.target.value) : null)}
          disabled={!hydrated || variants.length === 0}
        >
          {variants.length === 0 ? <option value="">No hay variantes</option> : null}
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id} disabled={variant.stock <= 0}>
              {variant.size} / {variant.color}{variant.stock <= 0 ? " - Sin stock" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hydrated || selectedVariantId === null}
      >
        Añadir al carrito
      </button>
      <div className="detail-mono min-h-6 text-sm" aria-live="polite">
        {addedNotice ? <p>{addedNotice}</p> : null}
        {attempted && notice ? <p>{notice}</p> : null}
      </div>
    </form>
  );
}