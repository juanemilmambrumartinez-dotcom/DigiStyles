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
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, currencies.indexOf(value)));
  const selected = brand.monedas[value];

  function openListbox() {
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }

  function closeListbox() {
    setOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setMounted(false);
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeListbox();
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  useEffect(() => {
    if (open) listboxRef.current?.focus();
  }, [open]);

  function changeCurrency(currency: CurrencyCode) {
    persistCurrency(currency);
    closeListbox();
    router.refresh();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openListbox();
      setActiveIndex(Math.max(0, currencies.indexOf(value)));
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) closeListbox();
      else openListbox();
    }
    if (event.key === "Escape") closeListbox();
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      closeListbox();
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + currencies.length) % currencies.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(currencies.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      changeCurrency(currencies[activeIndex]);
      triggerRef.current?.focus();
      return;
    }
    if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
      const search = event.key.toUpperCase();
      const nextIndex = currencies.findIndex((code, index) => index > activeIndex && code.startsWith(search));
      const firstMatch = currencies.findIndex((code) => code.startsWith(search));
      if (nextIndex >= 0) setActiveIndex(nextIndex);
      else if (firstMatch >= 0) setActiveIndex(firstMatch);
    }
  }

  return (
    <div ref={rootRef} className="relative z-[210] detail-mono text-sm text-foreground">
      <span className="mr-2 hidden uppercase sm:inline">Moneda</span>
      <button
        ref={triggerRef}
        type="button"
        className="t-button currency-trigger liquid-glass min-w-24 px-3 py-2 text-left uppercase"
        aria-label={`Moneda: ${selected.codigo} ${selected.simbolo}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="currency-listbox"
        onClick={() => (open ? closeListbox() : openListbox())}
        onKeyDown={handleTriggerKeyDown}
      >
        {selected.codigo} {selected.simbolo}
        <span aria-hidden="true" className="float-right ml-2">⌄</span>
      </button>
      {mounted && (
        <div
          id="currency-listbox"
          ref={listboxRef}
          role="listbox"
          aria-label="Seleccionar moneda"
          aria-activedescendant={`currency-option-${currencies[activeIndex]}`}
          aria-hidden={!open}
          tabIndex={-1}
          data-state={open ? "open" : "closed"}
          className="t-dropdown currency-panel liquid-glass absolute right-0 top-[calc(100%+0.5rem)] z-[220] min-w-full overflow-hidden"
          onKeyDown={handleListKeyDown}
          onTransitionEnd={(event) => {
            if (!open && event.propertyName === "opacity") setMounted(false);
          }}
        >
          {currencies.map((code, index) => {
            const currency = brand.monedas[code];
            return (
              <button
                key={code}
                type="button"
                id={`currency-option-${code}`}
                role="option"
                aria-selected={code === value}
                tabIndex={-1}
                data-active={activeIndex === index}
                className="currency-option block w-full px-3 py-2 text-left uppercase"
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
