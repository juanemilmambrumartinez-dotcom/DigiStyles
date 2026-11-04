"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, Ref } from "react";
import { useCart } from "@/components/cart/CartProvider";

type CartButtonProps = {
  buttonRef?: Ref<HTMLAnchorElement>;
  isOpen: boolean;
  onOpen: () => void;
};

export function CartButton({ buttonRef, isOpen, onOpen }: CartButtonProps) {
  const pathname = usePathname();
  const { itemCount, hydrated } = useCart();
  const label = hydrated
    ? `Carrito, ${itemCount} ${itemCount === 1 ? "artículo" : "artículos"}`
    : "Carrito";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || pathname === "/carrito") return;
    event.preventDefault();
    onOpen();
  }

  return (
    <Link
      ref={buttonRef}
      href="/carrito"
      className="t-button relative border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 text-sm font-bold uppercase text-foreground"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={handleClick}
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
