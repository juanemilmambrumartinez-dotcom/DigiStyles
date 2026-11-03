"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CART_STORAGE_KEY,
  MAX_CART_LINES,
  MAX_QUANTITY,
  MIN_QUANTITY,
  normalizeCartLines,
  readCart,
  readCartValue,
  writeCart,
  type StoredCartLine,
} from "@/lib/cart-storage";
import {
  validateCart as validateCartApi,
  type CartValidationResponse,
} from "@/lib/cart-api";

interface CartContextValue {
  lines: StoredCartLine[];
  addItem: (variantId: number, quantity: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  removeItem: (variantId: number) => void;
  clear: () => void;
  itemCount: number;
  hydrated: boolean;
  notice: string | null;
  validate: () => Promise<CartValidationResponse | null>;
  validation: CartValidationResponse | null;
  validationError: string | null;
  validating: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

function clampQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

function validVariantId(variantId: number) {
  return Number.isInteger(variantId) && variantId > 0;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<StoredCartLine[]>([]);
  const linesRef = useRef(lines);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [validation, setValidation] = useState<CartValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedLines = readCart();
      linesRef.current = storedLines;
      setLines(storedLines);
      setHydrated(true);
    }, 0);

    function handleStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) {
        const storedLines = readCartValue(event.newValue);
        linesRef.current = storedLines;
        setLines(storedLines);
        setNotice(null);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (hydrated) writeCart(lines);
  }, [hydrated, lines]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const addItem = useCallback((variantId: number, quantity: number) => {
    if (!validVariantId(variantId)) {
      setNotice("No se pudo añadir la variante al carrito.");
      return;
    }

    const requestedQuantity = clampQuantity(quantity);
    const currentLines = linesRef.current;
    const existingLine = currentLines.find((line) => line.variantId === variantId);
    let nextLines = currentLines;
    let nextNotice: string | null = null;

    if (existingLine) {
      const requestedTotal = existingLine.quantity + requestedQuantity;
      const nextQuantity = Math.min(MAX_QUANTITY, requestedTotal);
      nextNotice = nextQuantity < requestedTotal
        ? "La cantidad máxima por variante es 10."
        : null;
      nextLines = currentLines.map((line) => line.variantId === variantId
        ? { ...line, quantity: nextQuantity }
        : line);
    } else if (currentLines.length >= MAX_CART_LINES) {
      nextNotice = "No se pueden añadir más de 20 líneas al carrito.";
    } else {
      nextNotice = quantity > MAX_QUANTITY
        ? "La cantidad máxima por variante es 10."
        : null;
      nextLines = [...currentLines, { variantId, quantity: requestedQuantity }];
    }

    linesRef.current = nextLines;
    setLines(nextLines);
    setNotice(nextNotice);
  }, []);

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    const nextQuantity = clampQuantity(quantity);
    const nextLines = linesRef.current.map((line) => line.variantId === variantId
      ? { ...line, quantity: nextQuantity }
      : line);
    linesRef.current = nextLines;
    setLines(nextLines);
    setNotice(quantity > MAX_QUANTITY
      ? "La cantidad máxima por variante es 10."
      : null);
  }, []);

  const removeItem = useCallback((variantId: number) => {
    const nextLines = linesRef.current.filter((line) => line.variantId !== variantId);
    linesRef.current = nextLines;
    setLines(nextLines);
    setNotice(null);
  }, []);

  const clear = useCallback(() => {
    linesRef.current = [];
    setLines([]);
    setNotice(null);
    setValidation(null);
    setValidationError(null);
  }, []);

  const validate = useCallback(async () => {
    setValidating(true);
    setValidationError(null);

    try {
      const result = await validateCartApi(normalizeCartLines(linesRef.current));
      setValidation(result);
      return result;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "No se pudo validar el carrito.";
      setValidationError(message);
      return null;
    } finally {
      setValidating(false);
    }
  }, []);

  const value = useMemo<CartContextValue>(() => ({
      lines,
      addItem,
      setQuantity,
      removeItem,
      clear,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      hydrated,
      notice,
      validate,
      validation,
      validationError,
      validating,
    }), [
      lines,
      addItem,
      setQuantity,
      removeItem,
      clear,
      hydrated,
      notice,
      validate,
      validation,
      validationError,
      validating,
    ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider.");
  return context;
}