"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session/SessionProvider";
import { fetchOrders, formatOrderPrice, type OrderSummary } from "@/lib/orders-client";
import { safeNext } from "@/lib/safe-next";

function OrdersSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 animate-pulse">
      <div className="h-12 w-56 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
      <div className="h-28 border-[var(--brand-border-width)] border-foreground bg-surface" />
    </div>
  );
}

function paymentMethodLabel(paymentMethod: OrderSummary["paymentMethod"]) {
  return paymentMethod === "transferencia" ? "Transferencia bancaria" : "Contra entrega";
}

export function OrdersList() {
  const router = useRouter();
  const { estado } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (estado === "anonimo") {
      router.replace(`/ingresar?next=${encodeURIComponent(safeNext("/pedidos"))}`);
      return;
    }
    if (estado !== "autenticado") return;

    let active = true;

    async function loadOrders() {
      const result = await fetchOrders();
      if (!active) return;
      if (result.kind === "unauthenticated") {
        router.replace(`/ingresar?next=${encodeURIComponent(safeNext("/pedidos"))}`);
        return;
      }
      if (result.kind === "error") {
        setError(true);
        setLoading(false);
        return;
      }
      setOrders(result.orders);
      setLoading(false);
    }

    void loadOrders();
    return () => { active = false; };
  }, [attempt, estado, router]);

   function retry() {
    setError(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  if (estado === "cargando" || estado === "anonimo" || (estado === "autenticado" && loading)) {
    return <OrdersSkeleton />;
  }

  if (estado === "error") {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Mis pedidos</h1>
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

  if (error) {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Mis pedidos</h1>
        <div role="alert" className="border-[var(--brand-border-width)] border-accent bg-surface p-4">
          No pudimos cargar tus pedidos. Inténtalo de nuevo.
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

  if (orders.length === 0) {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl sm:text-5xl">Mis pedidos</h1>
        <p>Aún no tienes pedidos.</p>
        <Link
          className="t-button w-fit border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/productos"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl sm:text-5xl">Mis pedidos</h1>
      <ul className="grid min-w-0 gap-4">
        {orders.map((order) => (
          <li key={order.id} className="brutal-card min-w-0 bg-surface p-4 sm:p-5">
            <Link
              className="grid min-w-0 gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href={`/pedidos/${encodeURIComponent(order.id)}`}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-2xl">{order.orderNumber}</h2>
                <span className="detail-mono shrink-0">{formatOrderPrice(order.total)}</span>
              </div>
              <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
                <div><dt className="font-bold">Estado</dt><dd>{order.status}</dd></div>
                <div><dt className="font-bold">Método de pago</dt><dd>{paymentMethodLabel(order.paymentMethod)}</dd></div>
                <div><dt className="font-bold">Fecha</dt><dd>{new Date(order.date).toLocaleString("es-DO")}</dd></div>
                <div><dt className="font-bold">Artículos</dt><dd>{order.totalItems}</dd></div>
              </dl>
              <span className="font-bold uppercase text-accent">Ver detalle</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}