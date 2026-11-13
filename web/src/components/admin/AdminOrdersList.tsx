"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/session/SessionProvider";
import {
  ADMIN_ORDER_STATUSES,
  fetchAdminOrders,
  formatOrderPrice,
  type AdminOrderStatus,
  type AdminOrderSummary,
} from "@/lib/admin-client";
import { safeNext } from "@/lib/safe-next";

const filterOptions: Array<{ label: string; status?: AdminOrderStatus }> = [
  { label: "Todos" },
  ...ADMIN_ORDER_STATUSES.map((status) => ({ label: status, status })),
];

function isAdminOrderStatus(value: string | null): value is AdminOrderStatus {
  return value !== null && ADMIN_ORDER_STATUSES.includes(value as AdminOrderStatus);
}

function paymentMethodLabel(paymentMethod: AdminOrderSummary["paymentMethod"]) {
  return paymentMethod === "transferencia" ? "Transferencia bancaria" : "Contra entrega";
}

function OrdersSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 animate-pulse">
      <div className="h-12 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
    </div>
  );
}

export function AdminOrdersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario, estado } = useSession();
  const requestedStatus = searchParams.get("status");
  const status = isAdminOrderStatus(requestedStatus) ? requestedStatus : undefined;
  const nextDestination = status ? `/admin/pedidos?status=${encodeURIComponent(status)}` : "/admin/pedidos";
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (estado === "anonimo") {
      router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
      return;
    }
    if (estado !== "autenticado" || !usuario || !usuario.roles.includes("admin")) return;

    let active = true;

    async function loadOrders() {
      setLoading(true);
      setErrorStatus(null);
      setForbidden(false);
      const result = await fetchAdminOrders(status);
      if (!active) return;
      if (result.kind === "unauthenticated") {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext(nextDestination))}`);
        return;
      }
      if (result.kind === "forbidden") {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (result.kind === "error") {
        setErrorStatus(result.status);
        setLoading(false);
        return;
      }
      setOrders(result.orders);
      setLoading(false);
    }

    void loadOrders();
    return () => { active = false; };
  }, [attempt, estado, nextDestination, router, status, usuario]);

  function retry() {
    setErrorStatus(null);
    setForbidden(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  
    if (estado === "autenticado" && usuario && !usuario.roles.includes("admin")) {
    return <h1 className="text-3xl sm:text-5xl">No encontramos esta página</h1>;
  }

  if (estado === "cargando" || estado === "anonimo" || (estado === "autenticado" && loading)) {
    return <OrdersSkeleton />;
  }

  if (estado === "error") {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Administración de pedidos</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
          No pudimos verificar tu sesión. Inténtalo de nuevo.
        </div>
        <button
          type="button"
          className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    );
  }


  if (forbidden) {
    return <h1 className="text-3xl sm:text-5xl">No encontramos esta página</h1>;
  }

  if (errorStatus !== null) {
    const message = errorStatus === 429
      ? "Espera un momento antes de intentarlo de nuevo."
      : "No pudimos cargar los pedidos.";
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Administración de pedidos</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
          {message}
        </div>
        <button
          type="button"
          className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={retry}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-2">
        <h1 className="text-3xl sm:text-5xl">Administración de pedidos</h1>
        <p className="text-sm text-foreground-soft">Se muestran los 50 pedidos más recientes.</p>
      </div>
      <nav aria-label="Filtrar pedidos por estado" className="flex min-w-0 flex-wrap gap-2">
        {filterOptions.map((option) => {
          const isActive = option.status === status || (!option.status && !status);
          const href = option.status
            ? `/admin/pedidos?status=${encodeURIComponent(option.status)}`
            : "/admin/pedidos";
          return (
            <Link
              key={option.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`t-button border-[var(--brand-border-width)] border-foreground px-3 py-2 text-sm font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isActive ? "bg-accent text-background" : "bg-surface"}`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      {orders.length === 0 ? <p className="py-8 text-foreground-soft">No hay pedidos con este estado.</p> : (
        <ul className="grid min-w-0 gap-4">
          {orders.map((order) => (
            <li key={order.id} className="brutal-card min-w-0 bg-surface p-4 sm:p-5">
              <Link
                className="grid min-w-0 gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={`/admin/pedidos/${encodeURIComponent(order.id)}`}
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-2xl">{order.orderNumber}</h2>
                  <span className="detail-mono shrink-0">{formatOrderPrice(order.total)}</span>
                </div>
                <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="font-bold">Estado</dt><dd>{order.status}</dd></div>
                  <div><dt className="font-bold">Método de pago</dt><dd>{paymentMethodLabel(order.paymentMethod)}</dd></div>
                  <div><dt className="font-bold">Fecha</dt><dd>{new Date(order.date).toLocaleString("es-DO")}</dd></div>
                  <div><dt className="font-bold">Artículos</dt><dd>{order.totalItems}</dd></div>
                  <div><dt className="font-bold">Contacto</dt><dd className="break-words">{order.contactName}</dd></div>
                </dl>
                <span className="font-bold uppercase text-accent">Ver detalle</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}