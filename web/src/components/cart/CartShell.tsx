"use client";

import { useRef, useState } from "react";
import { CartButton } from "@/components/cart/CartButton";
import { CartPanel } from "@/components/cart/CartPanel";
import type { CurrencyCode } from "@/lib/currency";

export function CartShell({ currency }: { currency: CurrencyCode }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLAnchorElement>(null);
  const openTimerRef = useRef<number | null>(null);

  function openPanel() {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    const currencyPanel = document.querySelector<HTMLElement>('.currency-panel[data-state="open"]');
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      openTimerRef.current = null;
    }, currencyPanel ? 140 : 0);
  }

  function closePanel() {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setOpen(false);
  }

  return (
    <>
      <CartButton
        buttonRef={openerRef}
        isOpen={open}
        onOpen={openPanel}
      />
      <CartPanel
        currency={currency}
        open={open}
        openerRef={openerRef}
        onClose={closePanel}
      />
    </>
  );
}