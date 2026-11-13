"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DemoNotice } from "@/components/DemoNotice";
import {
  changeOrderStatus,
  fetchAdminOrder,
  formatOrderPrice,
  type AdminOrderDetail,
  type AdminOrderStatus,
} from "@/lib/admin-client";
import { safeNext } from "@/lib/safe-next";
import { useSession } from "@/components/session/SessionProvider";

type ViewState = "loading" | "ok" | "notFound" | "forbidden" | "error";
type RequestedAction = { status: AdminOrderStatus; cancel: boolean };

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function paymentMethodLabel(paymentMethod: AdminOrderDetail["paymentMethod"]) {
  return paymentMethod === "transferencia" ? "Transferencia bancaria" : "Contra entrega";
}

function actionLabel(action: RequestedAction) {
  if (action.cancel) return "Cancelar pedido";
  if (action.status === "Confirmado") return "Confirmar";
  if (action.status === "Enviado") return "Marcar como enviado";
  return "Marcar como entregado";
}

function actionsForStatus(status: AdminOrderStatus): RequestedAction[] {
  if (status === "Pendiente") return [{ status: "Confirmado", cancel: false }, { status: "Cancelado", cancel: true }];
  if (status === "Confirmado") return [{ status: "Enviado", cancel: false }, { status: "Cancelado", cancel: true }];
  if (status === "Enviado") return [{ status: "Entregado", cancel: false }];
  return [];
}

interface OrderContentProps {
  order: AdminOrderDetail;
  busy: boolean;
  saving: boolean;
  cancelConfirmation: boolean;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  confirmationRef: React.RefObject<HTMLDivElement | null>;
  onAction: (action: RequestedAction) => void;
  onOpenCancel: () => void;
  onCloseCancel: () => void;
}

function OrderContent({
  order,
  busy,
  saving,
  cancelConfirmation,
  cancelButtonRef,
  confirmationRef,
  onAction,
  onOpenCancel,
  onCloseCancel,
}: OrderContentProps) {
  const actions = actionsForStatus(order.status);
  const cancelAction = actions.find((action) => action.cancel);

  return (
    <>
      <header className="grid gap-3 border-b-[var(--brand-border-width)] border-foreground pb-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="detail-mono text-sm font-bold uppercase text-accent">Administración de pedidos</p>
          <Link className="font-bold uppercase text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/admin/pedidos">
            Volver a la lista
          </Link>
        </div>
        <h1 className="break-words text-4xl sm:text-6xl">{order.orderNumber}</h1>
        <p className="font-bold">{order.status}</p>
        <p className="detail-mono text-sm text-foreground-soft">{new Date(order.date).toLocaleString("es-DO")}</p>
        <p className="break-words text-sm">Cliente: {order.userEmail}</p>
        {actions.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-3">
        {actions.filter((action) => !action.cancel).map((action) => (
              <button
                key={action.status}
                type="button"
                className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => onAction(action)}
                disabled={busy}
              >
                {saving ? "Guardando..." : actionLabel(action)}
              </button>
            ))}
            {cancelAction ? (
              <button
                ref={cancelButtonRef}
                type="button"
                className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={onOpenCancel}
                disabled={busy}
              >
                {saving ? "Guardando..." : actionLabel(cancelAction)}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="border-[var(--brand-border-width)] border-foreground bg-surface p-4">Este es un estado final y no admite más acciones.</p>
        )}
        {cancelConfirmation && cancelAction ? (
          <div
            ref={confirmationRef}
            tabIndex={-1}
            role="region"
            aria-label="Confirmar cancelación"
                    className="grid min-w-0 gap-3 border-[var(--brand-border-width)] border-accent bg-surface p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <p>Se cancelará el pedido y se devolverá el stock. No se puede deshacer.</p>
            <div className="flex min-w-0 flex-wrap gap-3">
              <button
                type="button"
                className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => onAction(cancelAction)}
                disabled={busy}
              >
                {saving ? "Guardando..." : "Sí, cancelar"}
              </button>
              <button
                type="button"
                className="t-button border-[var(--brand-border-width)] border-foreground bg-surface px-4 py-3 font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={onCloseCancel}
                disabled={busy}
              >
                No, volver
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <section aria-labelledby="lineas-title" className="grid gap-3">
        <h2 id="lineas-title" className="text-2xl">Productos</h2>
        <ul className="grid min-w-0 gap-3">
          {order.lines.map((line, index) => (
            <li key={`${line.variantId ?? line.productName}-${index}`} className="min-w-0 border-[var(--brand-border-width)] border-foreground bg-surface p-4">
              <div className="flex min-w-0 flex-wrap justify-between gap-3">
                <h3 className="min-w-0 break-words text-xl">{line.productName}</h3>
                <span className="detail-mono shrink-0">{formatOrderPrice(line.lineTotal)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground-soft">Talla: {line.size} / Color: {line.color}</p>
              <p className="mt-1 text-sm">Cantidad: {line.quantity} · Precio unitario: {formatOrderPrice(line.unitPrice)} · Total de línea: {formatOrderPrice(line.lineTotal)}</p>
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

      <section aria-labelledby="pago-title" className="grid gap-3">
        <h2 id="pago-title" className="text-2xl">Método de pago</h2>
        <p className="border-[var(--brand-border-width)] border-foreground bg-surface p-4">{paymentMethodLabel(order.paymentMethod)}</p>
      </section>
    </>
  );
}

export function AdminOrderDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario, estado } = useSession();
  const id = typeof params.id === "string" ? params.id : "";
  const nextDestination = `/admin/pedidos/${id}`;
  const idIsValid = guidPattern.test(id);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  const [resultNotice, setResultNotice] = useState<string | null>(null);
  const [actionToRetry, setActionToRetry] = useState<RequestedAction | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const resultNoticeRef = useRef<HTMLDivElement>(null);
  const statusLock = useRef(false);
  const confirmationWasOpen = useRef(false);

  useEffect(() => {
    if (estado === "anonimo") {
      router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
      return;
    }
    if (estado !== "autenticado" || !usuario || !usuario.roles.includes("admin")) return;
        if (!idIsValid) return;

    let active = true;

    async function loadOrder() {
      setViewState("loading");
      const result = await fetchAdminOrder(id);
      if (!active) return;
      if (result.kind === "ok") {
        setOrder(result.order);
        setViewState("ok");
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
        return;
      }
      setViewState(result.kind === "forbidden" ? "forbidden" : result.kind === "notFound" ? "notFound" : "error");
    }

    void loadOrder();
    return () => { active = false; };
    }, [attempt, estado, id, idIsValid, nextDestination, router, usuario]);

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
    if (resultNotice) resultNoticeRef.current?.focus();
  }, [resultNotice]);

  function retryLoad() {
    setReloadError(false);
    setViewState("loading");
    setAttempt((value) => value + 1);
  }

  function openCancelConfirmation() {
    setResultNotice(null);
    setActionToRetry(null);
    setReloadError(false);
    setCancelConfirmation(true);
  }

  async function reloadAfterChange(expectedStatus: AdminOrderStatus, successMessage: boolean) {
    setReloading(true);
    setReloadError(false);
    const result = await fetchAdminOrder(id);
    if (result.kind === "ok") {
      setOrder(result.order);
      setViewState("ok");
      setReloading(false);
      setResultNotice(successMessage
        ? `El pedido ahora está en estado ${result.order.status}.`
        : result.order.status === expectedStatus
          ? "El pedido fue actualizado."
          : `El pedido ahora está en estado ${result.order.status}.`);
      return;
    }
    setReloading(false);
    if (result.kind === "unauthenticated") {
      router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
      return;
    }
    if (result.kind === "forbidden") {
      setViewState("forbidden");
      setOrder(null);
      return;
    }
    if (result.kind === "notFound") {
      setViewState("notFound");
      setOrder(null);
      return;
    }
    setReloadError(true);
    setResultNotice(successMessage
      ? "El cambio se guardó, pero no pudimos recargar el pedido"
      : "No pudimos recargar el pedido");
  }

  async function submitAction(action: RequestedAction) {
    if (!order || statusLock.current) return;
    statusLock.current = true;
    setSaving(true);
    setResultNotice(null);
    setActionToRetry(null);

    try {
      const result = await changeOrderStatus(order.id, action.status);
      if (result.kind === "unauthenticated") {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
        return;
      }
      if (result.kind === "forbidden") {
        setViewState("forbidden");
        setOrder(null);
        setCancelConfirmation(false);
        return;
      }
      if (result.kind === "notFound") {
        setViewState("notFound");
        setOrder(null);
        setCancelConfirmation(false);
        return;
      }
      if (result.kind === "invalidTransition") {
        setCancelConfirmation(false);
        setResultNotice("Este pedido ya cambió de estado o no se puede cambiar así");
        await reloadAfterChange(action.status, false);
        return;
      }
      if (result.kind === "rateLimited") {
        setResultNotice("Espera un momento antes de intentarlo de nuevo");
        return;
      }
      if (result.kind === "error") {
        setActionToRetry(action);
        setResultNotice("No pudimos guardar el cambio. Inténtalo de nuevo.");
        return;
      }

      setCancelConfirmation(false);
      setActionToRetry(null);
      await reloadAfterChange(action.status, true);
    } finally {
      statusLock.current = false;
      setSaving(false);
    }
  }

  if (estado === "error") {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Pedido</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">No pudimos verificar tu sesión. Inténtalo de nuevo.</div>
        <button type="button" className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (estado === "autenticado" && usuario && !usuario.roles.includes("admin")) {
    return <h1 className="text-3xl sm:text-5xl">No encontramos esta página</h1>;
  }

  if (estado === "cargando" || estado === "anonimo") return <OrderSkeleton />;
  if (idIsValid && viewState === "loading") return <OrderSkeleton />;

  if (viewState === "forbidden") return <h1 className="text-3xl sm:text-5xl">No encontramos esta página</h1>;

  if (!idIsValid || viewState === "notFound") {
    return (
      <>
        <DemoNotice />
        <div className="grid gap-5">
          <h1 className="text-3xl sm:text-5xl">No encontramos este pedido</h1>
          <Link className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/admin/pedidos">
            Volver a la lista
          </Link>
        </div>
      </>
    );
  }

  if (viewState === "error" || !order) {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Pedido</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">No pudimos cargar tu pedido. Inténtalo de nuevo.</div>
        <button type="button" className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={retryLoad}>
          Reintentar
        </button>
      </div>
    );
  }

  const busy = saving || reloading;

  return (
    <>
      <DemoNotice />
      {resultNotice ? (
        <div ref={resultNoticeRef} role="status" tabIndex={-1} className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
          <p>{resultNotice}</p>
          {reloadError ? (
            <button type="button" className="t-button mt-3 border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => { void reloadAfterChange(order.status, true); }} disabled={busy}>
              Reintentar
            </button>
          ) : null}
          {actionToRetry ? (
            <button type="button" className="t-button mt-3 border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => { void submitAction(actionToRetry); }} disabled={busy}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
      {reloading ? <p className="text-sm text-foreground-soft" role="status">Actualizando el pedido...</p> : null}
      <OrderContent
        order={order}
        busy={busy}
        saving={saving}
        cancelConfirmation={cancelConfirmation}
        cancelButtonRef={cancelButtonRef}
        confirmationRef={confirmationRef}
        onAction={(action) => { void submitAction(action); }}
        onOpenCancel={openCancelConfirmation}
        onCloseCancel={() => setCancelConfirmation(false)}
      />
    </>
  );
}