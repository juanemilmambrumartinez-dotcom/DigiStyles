"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";

const validationDelayMs = 280;

export function useCartValidation({ enabled }: { enabled: boolean }) {
  const {
    lines,
    validate,
  } = useCart();
  const [validatedSignature, setValidatedSignature] = useState<string | null>(null);
  const validationRunRef = useRef(0);
  const linesSignature = lines.map((line) => `${line.variantId}:${line.quantity}`).join("|");
  const hasLines = lines.length > 0;

  const runValidation = useCallback((signature: string) => {
    const runId = validationRunRef.current + 1;
    validationRunRef.current = runId;

    void validate().then(() => {
      if (runId === validationRunRef.current) setValidatedSignature(signature);
    });
  }, [validate]);

  useEffect(() => {
    if (!enabled) return;

    const runId = validationRunRef.current + 1;
    validationRunRef.current = runId;

    if (!hasLines) return;

    const timer = window.setTimeout(() => {
      if (runId !== validationRunRef.current) return;
      runValidation(linesSignature);
    }, validationDelayMs);

    return () => {
      window.clearTimeout(timer);
      validationRunRef.current += 1;
    };
  }, [enabled, hasLines, linesSignature, runValidation]);

  return {
    linesSignature,
    validatedSignature: enabled ? validatedSignature : null,
    runValidation,
  };
}