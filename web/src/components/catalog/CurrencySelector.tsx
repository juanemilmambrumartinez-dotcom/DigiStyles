"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import { currencyCookieName, type CurrencyCode } from "@/lib/currency";

const currencies = Object.keys(brand.monedas) as CurrencyCode[];

function persistCurrency(currency: CurrencyCode) {
  document.cookie = `${currencyCookieName}=${currency}; path=/; max-age=31536000; samesite=lax`;
}

export function CurrencySelector({ value }: { value: CurrencyCode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, currencies.indexOf(value)));
  const selected = brand.monedas[value];

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function changeCurrency(currency: CurrencyCode) {
    persistCurrency(currency);
    setOpen(false);
    router.refresh();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.max(0, currencies.indexOf(value)));
    }
    if (event.key === "Escape") setOpen(false);
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + currencies.length) % currencies.length);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      changeCurrency(currencies[activeIndex]);
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative z-[110] detail-mono text-sm text-foreground">
      <span className="mr-2 hidden uppercase sm:inline">Moneda</span>
      <button
        ref={triggerRef}
        type="button"
        className="liquid-glass min-w-24 px-3 py-2 text-left uppercase"
        aria-label={`Moneda: ${selected.codigo} ${selected.simbolo}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        {selected.codigo} {selected.simbolo}
        <span aria-hidden="true" className="float-right ml-2">⌄</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Seleccionar moneda"
          tabIndex={-1}
          className="liquid-glass absolute right-0 top-[calc(100%+0.5rem)] z-[120] min-w-full overflow-hidden"
          onKeyDown={handleListKeyDown}
        >
          {currencies.map((code, index) => {
            const currency = brand.monedas[code];
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={code === value}
                tabIndex={activeIndex === index ? 0 : -1}
                className={`block w-full px-3 py-2 text-left uppercase hover:bg-accent hover:text-background ${code === value ? "text-accent" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => changeCurrency(code)}
              >
                {currency.codigo} {currency.simbolo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
