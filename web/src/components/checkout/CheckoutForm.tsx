"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { useCart } from "@/components/cart/CartProvider";
import { useSession } from "@/components/session/SessionProvider";
import { formatOrderPrice, createOrder, type CreateOrderRequest, type PaymentMethod } from "@/lib/orders-client";
import { safeNext } from "@/lib/safe-next";
import type { CurrencyCode } from "@/lib/currency";
import type { CartValidationResponse } from "@/lib/cart-api";

interface CheckoutInfo {
  currency: "DOP";
  shippingCost: number;
}

type FormValues = {
  name: string;
  phone: string;
  address: string;
  city: string;
  note: string;
  paymentMethod: PaymentMethod;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;
type CartState = "loading" | "empty" | "ready" | "invalid" | "error";

type UiError = {
  message: string;
  retryable: boolean;
  requiresNewKey: boolean;
  stockLines: Array<{ variantId: number; status: string; message: string }>;
};

const initialForm: FormValues = {
  name: "",
  phone: "",
  address: "",
  city: "",
  note: "",
  paymentMethod: "contra_entrega",
};

function createIdempotencyKey() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`.slice(0, 64);
}

function isValidCart(validation: CartValidationResponse) {
  return validation.lines.length > 0 && validation.lines.every((line) => line.status === "ok");
}

function getStockLines(details: unknown) {
  if (!Array.isArray(details)) return [];
  return details.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const value = line as { variantId?: unknown; status?: unknown; message?: unknown };
    if (typeof value.variantId !== "number") return [];
    return [{
      variantId: value.variantId,
      status: typeof value.status === "string" ? value.status : "no disponible",
      message: typeof value.message === "string" ? value.message : "Esta línea necesita revisión.",
    }];
  });
}

function getErrorMessage(status: number, code: string | null) {
  if (status === 503) return "No pudimos conectar con el servicio. El pedido podría haberse creado.";
  switch (code) {
    case "demasiados_pendientes":
      return "Tienes demasiados pedidos pendientes. Completa o revisa uno antes de continuar.";
    case "carrito_invalido":
      return "El carrito cambió y necesita validarse de nuevo.";
    case "clave_reutilizada":
      return "La clave de este intento ya no puede reutilizarse. Puedes generar un nuevo intento.";
    case "reintentar":
      return "El pedido está siendo procesado. Inténtalo de nuevo en unos segundos.";
    case "limite_excedido":
      return "La solicitud supera el límite permitido. Revisa los datos e inténtalo de nuevo.";
    default:
      return "No pudimos crear el pedido. Revisa los datos e inténtalo de nuevo.";
  }
}

function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const fields: Array<[keyof FormValues, string, number]> = [
    ["name", "El nombre debe tener entre 1 y 100 caracteres.", 100],
    ["phone", "El teléfono debe tener entre 1 y 20 caracteres.", 20],
    ["address", "La dirección debe tener entre 1 y 200 caracteres.", 200],
    ["city", "La ciudad debe tener entre 1 y 100 caracteres.", 100],
  ];

  for (const [field, message, maxLength] of fields) {
    const value = values[field];
    if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
      errors[field] = message;
    }
  }

  if (values.note.trim().length > 300) errors.note = "La nota no puede superar 300 caracteres.";
  return errors;
}

function getPayload(values: FormValues, lines: CreateOrderRequest["lines"], expectedTotal: number): CreateOrderRequest {
  return {
    lines,
    paymentMethod: values.paymentMethod,
    contact: {
      name: values.name.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      note: values.note.trim() || null,
    },
    expectedTotal,
  };
}

export function CheckoutForm({ currency }: { currency: CurrencyCode }) {
  const router = useRouter();
  const { usuario, estado } = useSession();
  const { lines, clear, hydrated, validate } = useCart();
  const [values, setValues] = useState<FormValues>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);
  const [validation, setValidation] = useState<CartValidationResponse | null>(null);
  const [cartState, setCartState] = useState<CartState>("loading");
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [priceConflict, setPriceConflict] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const submitLockRef = useRef(false);
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const linesSignature = useMemo(
    () => lines.map((line) => `${line.variantId}:${line.quantity}`).join("|"),
    [lines],
  );

  useEffect(() => {
    if (estado === "anonimo") {
      router.replace(`/ingresar?next=${encodeURIComponent(safeNext("/checkout"))}`);
    }
  }, [estado, router]);

  useEffect(() => {
    if (estado !== "autenticado" || !usuario || !hydrated) return;

    let active = true;
    async function loadCheckout() {
      setUiError(null);
      setPriceConflict(null);
      setCheckoutInfo(null);
      setValidation(null);
      setCartMessage(null);

      if (lines.length === 0) {
        setCartState("empty");
        return;
      }

      setCartState("loading");
      try {
        const [infoResponse, validationResponse] = await Promise.all([
          fetch("/api/checkout/info", { cache: "no-store" }),
          validate(),
        ]);

        if (!infoResponse.ok) throw new Error("checkout-info");
        const info = await infoResponse.json() as Partial<CheckoutInfo>;
        if (info.currency !== "DOP" || typeof info.shippingCost !== "number" || !Number.isFinite(info.shippingCost)) {
          throw new Error("checkout-info");
        }
        if (!active) return;

        setCheckoutInfo({ currency: "DOP", shippingCost: info.shippingCost });
        if (!validationResponse) {
          setCartState("error");
          setCartMessage("No pudimos validar el carrito. Comprueba tu conexión e inténtalo de nuevo.");
          return;
        }

        setValidation(validationResponse);
        if (isValidCart(validationResponse)) {
          setCartState("ready");
        } else {
          setCartState("invalid");
          setCartMessage("Una o más líneas ya no están disponibles. Revisa el carrito antes de continuar.");
        }
      } catch {
        if (!active) return;
        setCartState("error");
        setCartMessage("No pudimos cargar el resumen del pedido. Inténtalo de nuevo.");
      }
    }

    void loadCheckout();
    return () => { active = false; };
  }, [estado, hydrated, linesSignature, retryToken, usuario, validate, lines.length]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value } as FormValues));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setUiError(null);
  }

  function getKey(signature: string, forceNew: boolean) {
    if (!forceNew && keyRef.current?.signature === signature) return keyRef.current.key;
    const key = createIdempotencyKey();
    keyRef.current = { signature, key };
    return key;
  }

  async function submitOrder(forceNewKey = false) {
    if (submitLockRef.current || estado !== "autenticado" || !usuario) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setUiError(null);
    setPriceConflict(null);

    try {
      const errors = validateForm(values);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;

      const latestValidation = await validate();
      if (!latestValidation || !checkoutInfo) {
        setCartState("error");
        setCartMessage("No pudimos validar el carrito. Inténtalo de nuevo.");
        return;
      }
      setValidation(latestValidation);

      if (!isValidCart(latestValidation)) {
        setCartState("invalid");
        setCartMessage("Una o más líneas ya no están disponibles. Revisa el carrito antes de continuar.");
        return;
      }

      setCartState("ready");
      const expectedTotal = latestValidation.total + checkoutInfo.shippingCost;
      const payload = getPayload(values, lines, expectedTotal);
      const signature = JSON.stringify({
        lines: [...lines].sort((a, b) => a.variantId - b.variantId),
        form: values,
        expectedTotal,
      });
      const result = await createOrder(payload, getKey(signature, forceNewKey));

      if (result.kind === "ok") {
        clear();
        router.replace(`/pedidos/${encodeURIComponent(result.id)}`);
        return;
      }

      if (result.status === 401) {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext("/checkout"))}`);
        return;
      }

      if (result.code === "precio_cambiado" && result.details && typeof result.details === "object") {
        const total = (result.details as { total?: unknown }).total;
        if (typeof total === "number" && Number.isFinite(total)) {
          setPriceConflict(total);
          return;
        }
      }

      const requiresNewKey = result.code === "clave_reutilizada";
      if (requiresNewKey) keyRef.current = null;
      setUiError({
        message: getErrorMessage(result.status, result.code),
        retryable: result.status === 503 || result.code === "reintentar" || requiresNewKey || result.code === "carrito_invalido",
        requiresNewKey,
        stockLines: result.code === "stock_o_disponibilidad" ? getStockLines(result.details) : [],
      });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  if (estado === "cargando") return <CheckoutSkeleton />;

  if (estado === "error") {
    return (
      <section className="brutal-card grid gap-5 bg-surface p-5 sm:p-8">
        <p className="detail-mono text-sm font-bold uppercase text-accent">Checkout</p>
        <h1 className="text-4xl sm:text-6xl">No pudimos verificar tu sesión</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">Inténtalo de nuevo sin cerrar esta página.</div>
        <button type="button" className="t-button w-fit bg-accent px-4 py-3 font-bold uppercase text-background" onClick={() => window.location.reload()}>Reintentar</button>
      </section>
    );
  }

  if (estado === "anonimo" || !usuario) return <CheckoutSkeleton />;
  if (!hydrated || cartState === "loading") return <CheckoutSkeleton />;

  if (cartState === "empty") {
    return (
      <section className="brutal-card grid gap-4 bg-surface p-5 sm:p-8">
        <p className="detail-mono text-sm font-bold uppercase text-accent">Checkout</p>
        <h1 className="text-4xl sm:text-6xl">Tu carrito está vacío</h1>
        <p className="text-foreground-soft">Añade productos antes de preparar tu pedido.</p>
        <Link href="/productos" className="t-button w-fit bg-accent px-4 py-3 font-bold uppercase text-background">Ver productos</Link>
      </section>
    );
  }

  const total = validation && checkoutInfo ? validation.total + checkoutInfo.shippingCost : null;
  const canSubmit = cartState === "ready" && Boolean(total) && !submitting;

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
      <section className="min-w-0">
        <DemoNotice />
        <header className="mt-6 border-b-[var(--brand-border-width)] border-foreground pb-5">
          <p className="detail-mono text-sm font-bold uppercase text-accent">Checkout / Pedido</p>
          <h1 className="mt-2 text-5xl leading-none sm:text-7xl">Datos de entrega</h1>
        </header>

        {cartMessage && (
          <div role="alert" className="mt-6 border-[var(--brand-border-width)] border-accent bg-surface p-4">
            <p>{cartMessage}</p>
            <button type="button" className="t-button mt-4 bg-accent px-4 py-3 font-bold uppercase text-background" onClick={() => setRetryToken((value) => value + 1)}>Reintentar</button>
          </div>
        )}

        {priceConflict !== null && (
          <div role="alert" className="mt-6 border-[var(--brand-border-width)] border-accent bg-surface p-4">
            <p>El total cambió. El nuevo total es <strong>{formatOrderPrice(priceConflict)}</strong>. Confirma para volver a validar y enviar el pedido.</p>
            <button type="button" disabled={submitting} className="t-button mt-4 bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { void submitOrder(true); }}>Confirmar y reintentar</button>
          </div>
        )}

        {uiError && (
          <div role="alert" className="mt-6 border-[var(--brand-border-width)] border-accent bg-surface p-4">
            <p>{uiError.message}</p>
            {uiError.stockLines.length > 0 && (
              <ul className="mt-3 grid gap-2 text-sm">
                {uiError.stockLines.map((line) => <li key={line.variantId}><strong>Variante {line.variantId}:</strong> {line.status}. {line.message}</li>)}
              </ul>
            )}
            {uiError.retryable && <button type="button" className="t-button mt-4 bg-accent px-4 py-3 font-bold uppercase text-background" onClick={() => { void submitOrder(uiError.requiresNewKey); }}>Reintentar</button>}
          </div>
        )}

        <form className="mt-8 grid gap-5" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitOrder(); }} noValidate>
          <div className="grid gap-2">
            <label htmlFor="checkout-name" className="detail-mono text-sm font-bold uppercase">Nombre</label>
            <input id="checkout-name" name="name" value={values.name} onChange={updateField} maxLength={100} autoComplete="name" disabled={submitting} aria-invalid={Boolean(fieldErrors.name)} className="min-h-12 border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {fieldErrors.name && <p className="text-sm text-accent">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="checkout-phone" className="detail-mono text-sm font-bold uppercase">Teléfono</label>
            <input id="checkout-phone" name="phone" value={values.phone} onChange={updateField} maxLength={20} autoComplete="tel" disabled={submitting} aria-invalid={Boolean(fieldErrors.phone)} className="min-h-12 border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {fieldErrors.phone && <p className="text-sm text-accent">{fieldErrors.phone}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="checkout-address" className="detail-mono text-sm font-bold uppercase">Dirección</label>
            <input id="checkout-address" name="address" value={values.address} onChange={updateField} maxLength={200} autoComplete="street-address" disabled={submitting} aria-invalid={Boolean(fieldErrors.address)} className="min-h-12 border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {fieldErrors.address && <p className="text-sm text-accent">{fieldErrors.address}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="checkout-city" className="detail-mono text-sm font-bold uppercase">Ciudad</label>
            <input id="checkout-city" name="city" value={values.city} onChange={updateField} maxLength={100} autoComplete="address-level2" disabled={submitting} aria-invalid={Boolean(fieldErrors.city)} className="min-h-12 border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {fieldErrors.city && <p className="text-sm text-accent">{fieldErrors.city}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="checkout-note" className="detail-mono text-sm font-bold uppercase">Nota <span className="font-normal normal-case">(opcional)</span></label>
            <textarea id="checkout-note" name="note" value={values.note} onChange={updateField} maxLength={300} rows={4} disabled={submitting} aria-invalid={Boolean(fieldErrors.note)} className="border-[var(--brand-border-width)] border-foreground bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {fieldErrors.note && <p className="text-sm text-accent">{fieldErrors.note}</p>}
          </div>
          <fieldset className="grid gap-3 border-[var(--brand-border-width)] border-foreground bg-surface p-4">
            <legend className="detail-mono px-2 text-sm font-bold uppercase">Método de pago</legend>
            <label className="flex items-center gap-3"><input type="radio" name="paymentMethod" value="contra_entrega" checked={values.paymentMethod === "contra_entrega"} onChange={updateField} disabled={submitting} /> Contra entrega</label>
            <label className="flex items-center gap-3"><input type="radio" name="paymentMethod" value="transferencia" checked={values.paymentMethod === "transferencia"} onChange={updateField} disabled={submitting} /> Transferencia</label>
          </fieldset>
          <button type="submit" disabled={!canSubmit} className="t-button w-full bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Enviando pedido..." : "Crear pedido"}</button>
        </form>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-labelledby="resumen-checkout">
        <div className="brutal-card bg-surface p-5 sm:p-6">
          <h2 id="resumen-checkout" className="text-3xl">Resumen</h2>
          <div className="mt-5 grid gap-3 border-t-[var(--brand-border-width)] border-foreground pt-4 detail-mono text-sm">
            <div className="flex justify-between gap-4"><span>Subtotal</span><span>{validation ? formatOrderPrice(validation.total) : "Actualizando..."}</span></div>
            <div className="flex justify-between gap-4"><span>Envío</span><span>{checkoutInfo ? formatOrderPrice(checkoutInfo.shippingCost) : "Actualizando..."}</span></div>
            <div className="flex justify-between gap-4 border-t-[var(--brand-border-width)] border-foreground pt-3 text-lg font-bold"><span>Total DOP</span><span>{total !== null ? formatOrderPrice(total) : "Actualizando..."}</span></div>
          </div>
          {currency !== "DOP" && <p className="mt-5 border-[var(--brand-border-width)] border-accent bg-accent p-3 text-sm font-bold text-background">El cobro se realizará en DOP. {currency} es solo una referencia.</p>}
        </div>
      </aside>
    </div>
  );
}

function CheckoutSkeleton() {
  return <div aria-hidden="true" className="h-[42rem] animate-pulse border-[var(--brand-border-width)] border-foreground bg-surface opacity-60" />;
}
