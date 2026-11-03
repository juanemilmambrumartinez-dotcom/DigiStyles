"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

export function CartButton() {
  const { itemCount, hydrated } = useCart();
  const label = hydrated
    ? `Carrito, ${itemCount} ${itemCount === 1 ? "artículo" : "artículos"}`
    : "Carrito";

  return (
    <Link
      href="/carrito"
      className="t-button relative border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-sm font-bold uppercase text-foreground"
      aria-label={label}
    >
      <span>Carrito</span>
      {hydrated && itemCount > 0 ? (
        <span className="count-badge detail-mono ml-2" aria-hidden="true">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
