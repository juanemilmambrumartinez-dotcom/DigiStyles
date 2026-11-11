"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DemoNotice } from "@/components/DemoNotice";
import { cancelOrder, fetchOrder, formatOrderPrice, type OrderDetail } from "@/lib/orders-client";
import { safeNext } from "@/lib/safe-next";

type ViewState = "loading" | "notFound" | "unauthenticated" | "error" | "ok";

function OrderSkeleton() {
  return (
    <div aria-hidden="true" className="grid min-w-0 gap-5 animate-pulse">
      <div className="h-10 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-48 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-40 border-[var(--brand-border-width)] border-foreground bg-surface" />
    </div>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-[var(--brand-border-width)] border-foreground bg-surface p-3">
      <dt className="detail-mono text-xs font-bold uppercase text-foreground-soft">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function PaymentDetails({ order }: { order: OrderDetail }) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(order.bankTransfer?.paymentReference ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (order.paymentMethod === "transferencia" && order.bankTransfer) {
    return (
      <section aria-labelledby="transferencia-title" className="brutal-card bg-surface p-4 sm:p-6">
        <h2 id="transferencia-title" className="text-2xl">Datos para tu transferencia</h2>
        <dl className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <DetailPair label="Banco" value={order.bankTransfer.bank} />
          <DetailPair label="Titular" value={order.bankTransfer.accountHolder} />
          <DetailPair label="Número de cuenta" value={order.bankTransfer.accountNumber} />
          <DetailPair label="Tipo de cuenta" value={order.bankTransfer.accountType} />
        </dl>
        <p className="mt-5 break-words">Transfiere {formatOrderPrice(order.total)} e incluye {order.orderNumber} como referencia de pago.</p>
        <button
          type="button"
          className="t-button mt-4 border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => { void copyReference(); }}
        >
          Copiar referencia
        </button>
        <p aria-live="polite" className="mt-3 min-h-6 text-sm">{copied ? "Referencia copiada." : ""}</p>
      </section>
    );
  }

  if (order.paymentMethod === "contra_entrega") {
    return <p className="border-[var(--brand-border-width)] border-foreground bg-surface p-4">Pagarás {formatOrderPrice(order.total)} al recibir tu pedido.</p>;
  }

  return null;
}

interface OrderContentProps {
  order: OrderDetail;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  confirmationRef: React.RefObject<HTMLDivElement | null>;
  cancelConfirmation: boolean;
  cancelling: boolean;
  cancelNotice: string | null;
  cancelError: string | null;
  onOpenCancel: () => void;
  onConfirmCancel: () => void;
  onCloseCancel: () => void;
  onRetryCancel: () => void;
}

function OrderContent({
  order,
  cancelButtonRef,
  confirmationRef,
  cancelConfirmation,
  cancelling,
  cancelNotice,
  cancelError,
  onOpenCancel,
  onConfirmCancel,
  onCloseCancel,
  onRetryCancel,
}: OrderContentProps) {
  return (
    <>
      <header className="grid gap-3 border-b-[var(--brand-border-width)] border-foreground pb-5">
        <p className="detail-mono text-sm font-bold uppercase text-accent">Pedido</p>
        <h1 className="break-words text-4xl sm:text-6xl">{order.orderNumber}</h1>
        <p className="font-bold">{order.status}</p>
        <p className="detail-mono text-sm text-foreground-soft">{new Date(order.date).toLocaleString("es-DO")}</p>
        {cancelNotice ? <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">{cancelNotice}</div> : null}
        {order.status === "Pendiente" ? (
          <div className="grid gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={onOpenCancel}
              disabled={cancelling}
            >
              Cancelar
            </button>
            {cancelConfirmation ? (
              <div
                ref={confirmationRef}
                tabIndex={-1}
                role="region"
                aria-label="Confirmar cancelación"
                className="grid gap-3 border-[var(--brand-border-width)] border-accent bg-surface p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <p>Se cancelará el pedido y se devolverá el stock. No se puede deshacer.</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={onConfirmCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelando..." : "Sí, cancelar"}
                  </button>
                  <button
                    type="button"
                    className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={onCloseCancel}
                    disabled={cancelling}
                  >
                    No, volver
                  </button>
                </div>
              </div>
            ) : null}
            {cancelError ? (
              <div role="alert" className="grid gap-3 border-[var(--brand-border-width)] border-accent bg-surface p-4">
                <p>{cancelError}</p>
                <button
                  type="button"
                  className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={onRetryCancel}
                >
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <section aria-labelledby="lineas-title" className="grid gap-3">
        <h2 id="lineas-title" className="text-2xl">Productos</h2>
        <ul className="grid gap-3">
          {order.lines.map((line, index) => (
            <li key={`${line.variantId ?? line.productName}-${index}`} className="border-[var(--brand-border-width)] border-foreground bg-surface p-4">
              <div className="flex min-w-0 flex-wrap justify-between gap-3">
                <h3 className="min-w-0 break-words text-xl">{line.productName}</h3>
                <span className="detail-mono shrink-0">{formatOrderPrice(line.lineTotal)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground-soft">Talla: {line.size} / Color: {line.color}</p>
              <p className="mt-1 text-sm">Cantidad: {line.quantity} · Precio unitario: {formatOrderPrice(line.unitPrice)}</p>
            </li>
          ))}
        </ul>
        <dl className="grid gap-2 border-t-[var(--brand-border-width)] border-foreground pt-4">
          <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd className="detail-mono">{formatOrderPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Envío</dt><dd className="detail-mono">{formatOrderPrice(order.shipping)}</dd></div>
          <div className="flex justify-between gap-4 border-t-[var(--brand-border-width)] border-foreground pt-3 text-xl font-bold"><dt>Total</dt><dd className="detail-mono break-all">{formatOrderPrice(order.total)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="entrega-title" className="brutal-card bg-surface p-4 sm:p-6">
        <h2 id="entrega-title" className="text-2xl">Datos de entrega</h2>
        <dl className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <DetailPair label="Nombre" value={order.delivery.name} />
          <DetailPair label="Teléfono" value={order.delivery.phone} />
          <DetailPair label="Dirección" value={order.delivery.address} />
          <DetailPair label="Ciudad" value={order.delivery.city} />
          {order.delivery.note ? <DetailPair label="Nota" value={order.delivery.note} /> : null}
        </dl>
      </section>

      {order.status === "Cancelado" ? (
        <p className="border-[var(--brand-border-width)] border-accent bg-surface p-4">Este pedido fue cancelado.</p>
      ) : (
        <section aria-labelledby="pago-title" className="grid gap-3">
          <h2 id="pago-title" className="text-2xl">Método de pago</h2>
          <p className="border-[var(--brand-border-width)] border-foreground bg-surface p-4">{order.paymentMethod === "transferencia" ? "Transferencia bancaria" : "Contra entrega"}</p>
          <PaymentDetails order={order} />
        </section>
      )}
    </>
  );
}

export function OrderDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<ViewState>("loading");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const cancelLock = useRef(false);
  const confirmationWasOpen = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      try {
        const result = await fetchOrder(id);
        if (!active) return;
        if (result.kind === "ok") {
          setOrder(result.order);
          setState("ok");
          return;
        }
        setState(result.kind);
      } catch {
        if (active) setState("error");
      }
    }

    void loadOrder();
    return () => { active = false; };
  }, [id, attempt]);

  useEffect(() => {
    if (cancelConfirmation) {
      confirmationRef.current?.focus();
      confirmationWasOpen.current = true;
    } else if (confirmationWasOpen.current) {
      cancelButtonRef.current?.focus();
      confirmationWasOpen.current = false;
    }
  }, [cancelConfirmation]);

  useEffect(() => {
    if (state === "unauthenticated") {
      router.replace(`/ingresar?next=${encodeURIComponent(`/pedidos/${id}`)}`);
    }
  }, [id, router, state]);

  function retry() {
    setState("loading");
    setAttempt((value) => value + 1);
  }

  function openCancelConfirmation() {
    setCancelError(null);
    setCancelConfirmation(true);
  }

  async function confirmCancel() {
    if (!order || cancelLock.current) return;
    cancelLock.current = true;
    setCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelOrder(order.id);
      if (result.kind === "unauthenticated") {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext(`/pedidos/${id}`))}`);
        return;
      }
      if (result.kind === "notFound") {
        setOrder(null);
        setState("notFound");
        return;
      }
      if (result.kind === "notCancelable") {
        setCancelNotice("Este pedido ya no se puede cancelar");
        setCancelConfirmation(false);
        setState("loading");
        setAttempt((value) => value + 1);
        return;
      }
      if (result.kind === "rateLimited") {
        setCancelError("Espera un momento antes de intentarlo de nuevo");
        return;
      }
      if (result.kind === "error") {
        setCancelError("No pudimos cancelar tu pedido. Inténtalo de nuevo.");
        return;
      }

      setCancelConfirmation(false);
      setCancelNotice(null);
      setState("loading");
      setAttempt((value) => value + 1);
    } finally {
      cancelLock.current = false;
      setCancelling(false);
    }
  }

  function retryCancel() {
    setCancelConfirmation(true);
    setCancelError(null);
  }

  if (state === "loading" || state === "unauthenticated") return <OrderSkeleton />;

  if (state === "notFound") {
    return (
      <>
        <DemoNotice />
        <div className="grid gap-5">
          <h1 className="text-3xl sm:text-5xl">No encontramos este pedido</h1>
          <Link
            className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/productos"
          >
            Ver productos
          </Link>
        </div>
      </>
    );
  }

  if (state === "error" || !order) {
    return (
      <>
        <DemoNotice />
        <div className="grid gap-5">
          <h1 className="text-3xl sm:text-5xl">Pedido</h1>
          <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
            No pudimos cargar tu pedido. Inténtalo de nuevo.
          </div>
          <button
            type="button"
            className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={retry}
          >
            Reintentar
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <DemoNotice />
      <OrderContent
        order={order}
        cancelButtonRef={cancelButtonRef}
        confirmationRef={confirmationRef}
        cancelConfirmation={cancelConfirmation}
        cancelling={cancelling}
        cancelNotice={cancelNotice}
        cancelError={cancelError}
        onOpenCancel={openCancelConfirmation}
        onConfirmCancel={() => { void confirmCancel(); }}
        onCloseCancel={() => setCancelConfirmation(false)}
        onRetryCancel={retryCancel}
      />
    </>
  );
}