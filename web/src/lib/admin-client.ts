import { authFetch } from "@/lib/auth-client";
import { formatOrderPrice, type OrderDelivery, type OrderLine } from "@/lib/orders-client";

export const ADMIN_ORDER_STATUSES = ["Pendiente", "Confirmado", "Enviado", "Entregado", "Cancelado"] as const;
export { formatOrderPrice };
export type AdminOrderStatus = typeof ADMIN_ORDER_STATUSES[number];

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentMethod: "transferencia" | "contra_entrega";
  total: number;
  date: string;
  totalItems: number;
  contactName: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentMethod: "transferencia" | "contra_entrega";
  currency: string;
  subtotal: number;
  shipping: number;
  total: number;
  date: string;
  lines: OrderLine[];
  delivery: OrderDelivery;
  bankTransfer: null;
  userEmail: string;
}

interface ApiError {
  code: string | null;
  message: string | null;
}

export type FetchAdminOrdersResult =
  | { kind: "ok"; orders: AdminOrderSummary[] }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "error"; status: number };

export type FetchAdminOrderResult =
  | { kind: "ok"; order: AdminOrderDetail }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "error"; status: number };

export type ChangeAdminOrderStatusResult =
  | { kind: "ok"; order: AdminOrderDetail }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "invalidTransition"; message: string }
  | { kind: "rateLimited" }
  | { kind: "error"; status: number };

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readError(body: unknown): ApiError {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
  return {
    code: typeof record?.code === "string" ? record.code : null,
    message: typeof record?.message === "string" ? record.message : null,
  };
}

function isSummary(value: unknown): value is AdminOrderSummary {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<AdminOrderSummary>;
  return typeof order.id === "string" && typeof order.orderNumber === "string"
    && typeof order.status === "string" && ADMIN_ORDER_STATUSES.includes(order.status as AdminOrderStatus)
    && (order.paymentMethod === "transferencia" || order.paymentMethod === "contra_entrega")
    && typeof order.total === "number" && typeof order.date === "string"
    && typeof order.totalItems === "number" && typeof order.contactName === "string";
}

function isDetail(value: unknown): value is AdminOrderDetail {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<AdminOrderDetail>;
  return typeof order.id === "string" && typeof order.orderNumber === "string"
    && typeof order.status === "string" && ADMIN_ORDER_STATUSES.includes(order.status as AdminOrderStatus)
    && (order.paymentMethod === "transferencia" || order.paymentMethod === "contra_entrega")
    && typeof order.currency === "string" && typeof order.subtotal === "number"
    && typeof order.shipping === "number" && typeof order.total === "number"
    && typeof order.date === "string" && Array.isArray(order.lines)
    && Boolean(order.delivery) && typeof order.userEmail === "string";
}

export async function fetchAdminOrders(status?: AdminOrderStatus): Promise<FetchAdminOrdersResult> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await authFetch(`/api/admin/orders${query}`);
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 403) return { kind: "forbidden" };
    if (!response.ok) return { kind: "error", status: response.status };
    const body: unknown = await response.json();
    return Array.isArray(body) && body.every(isSummary) ? { kind: "ok", orders: body } : { kind: "error", status: 503 };
  } catch {
    return { kind: "error", status: 503 };
  }
}

export async function fetchAdminOrder(id: string): Promise<FetchAdminOrderResult> {
  if (!guidPattern.test(id)) return { kind: "notFound" };
  try {
    const response = await authFetch(`/api/admin/orders/${encodeURIComponent(id)}`);
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 404) return { kind: "notFound" };
    if (!response.ok) return { kind: "error", status: response.status };
    const body: unknown = await response.json();
    return isDetail(body) ? { kind: "ok", order: { ...body, bankTransfer: null } } : { kind: "error", status: 503 };
  } catch {
    return { kind: "error", status: 503 };
  }
}

export async function changeOrderStatus(id: string, status: AdminOrderStatus): Promise<ChangeAdminOrderStatusResult> {
  try {
    const response = await authFetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 404) return { kind: "notFound" };
    if (response.status === 429) return { kind: "rateLimited" };
    let body: unknown = null;
    try { body = await response.json(); } catch { /* respuesta sin cuerpo */ }
    if (response.status === 409) {
      const error = readError(body);
      return { kind: error.code === "transicion_invalida" ? "invalidTransition" : "error", ...(error.code === "transicion_invalida" ? { message: error.message ?? "La transición de estado no está permitida." } : { status: 409 }) } as ChangeAdminOrderStatusResult;
    }
    if (!response.ok) return { kind: "error", status: response.status };
    return isDetail(body) ? { kind: "ok", order: { ...body, bankTransfer: null } } : { kind: "error", status: 503 };
  } catch {
    return { kind: "error", status: 503 };
  }
}