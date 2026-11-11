import { authFetch } from "@/lib/auth-client";
import { formatPrice } from "@/lib/currency";
import type { StoredCartLine } from "@/lib/cart-storage";

export interface OrderLine {
  variantId: number | null;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDelivery {
  name: string;
  phone: string;
  address: string;
  city: string;
  note: string | null;
}

export interface BankTransferDetails {
  bank: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  paymentReference: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: "Pendiente" | "Confirmado" | "Enviado" | "Entregado" | "Cancelado";
  paymentMethod: "transferencia" | "contra_entrega";
  currency: string;
  subtotal: number;
  shipping: number;
  total: number;
  date: string;
  lines: OrderLine[];
  delivery: OrderDelivery;
  bankTransfer: BankTransferDetails | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderDetail["status"];
  paymentMethod: "transferencia" | "contra_entrega";
  total: number;
  date: string;
  totalItems: number;
}

export type FetchOrderResult =
  | { kind: "ok"; order: OrderDetail }
  | { kind: "notFound" }
  | { kind: "unauthenticated" }
  | { kind: "error" };

export type FetchOrdersResult =
  | { kind: "ok"; orders: OrderSummary[] }
  | { kind: "unauthenticated" }
  | { kind: "error"; status: number };

export type CancelOrderResult =
  | { kind: "ok" }
  | { kind: "notFound" }
  | { kind: "notCancelable" }
  | { kind: "rateLimited" }
  | { kind: "unauthenticated" }
  | { kind: "error"; status: number };

export type PaymentMethod = "transferencia" | "contra_entrega";

export interface OrderContactRequest {
  name: string;
  phone: string;
  address: string;
  city: string;
  note: string | null;
}

export interface CreateOrderRequest {
  lines: StoredCartLine[];
  paymentMethod: PaymentMethod;
  contact: OrderContactRequest;
  expectedTotal: number;
}

export type CreateOrderResult =
  | { kind: "ok"; id: string; status: 200 | 201 }
  | { kind: "error"; status: number; code: string | null; message: string; details: unknown };

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isOrderDetail(value: unknown): value is OrderDetail {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<OrderDetail>;
  return typeof order.id === "string"
    && typeof order.orderNumber === "string"
    && typeof order.status === "string"
    && typeof order.paymentMethod === "string"
    && typeof order.currency === "string"
    && typeof order.subtotal === "number"
    && typeof order.shipping === "number"
    && typeof order.total === "number"
    && typeof order.date === "string"
    && Array.isArray(order.lines)
    && Boolean(order.delivery)
    && (order.bankTransfer == null || typeof order.bankTransfer === "object");
}

export function formatOrderPrice(amount: number) {
  return formatPrice(amount, "DOP");
}

function readErrorBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { code: null, message: "No se pudo crear el pedido.", details: undefined };
  }

  const errorBody = body as { code?: unknown; message?: unknown; details?: unknown };
  return {
    code: typeof errorBody.code === "string" ? errorBody.code : null,
    message: typeof errorBody.message === "string" ? errorBody.message : "No se pudo crear el pedido.",
    details: errorBody.details,
  };
}

export async function createOrder(
  payload: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  try {
    const response = await authFetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const error = readErrorBody(body);
      return { kind: "error", status: response.status, ...error };
    }

    if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
      return {
        kind: "error",
        status: response.status,
        code: "respuesta_invalida",
        message: "No se pudo confirmar el pedido.",
        details: undefined,
      };
    }

    return { kind: "ok", id: (body as { id: string }).id, status: response.status as 200 | 201 };
  } catch {
    return {
      kind: "error",
      status: 503,
      code: "servicio_no_disponible",
      message: "No pudimos conectar con el servicio. El pedido podría haberse creado.",
      details: undefined,
    };
  }
}

export async function fetchOrders(): Promise<FetchOrdersResult> {
  try {
    const response = await authFetch("/api/orders", { method: "GET" });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (!response.ok) return { kind: "error", status: response.status };

    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isOrderSummary)) return { kind: "error", status: 503 };
    return { kind: "ok", orders: body };
  } catch {
    return { kind: "error", status: 503 };
  }
}

export async function cancelOrder(id: string): Promise<CancelOrderResult> {
  try {
    const response = await authFetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 404) return { kind: "notFound" };
    if (response.status === 429) return { kind: "rateLimited" };
    if (response.status === 409) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return body && typeof body === "object" && (body as { code?: unknown }).code === "no_cancelable"
        ? { kind: "notCancelable" }
        : { kind: "error", status: response.status };
    }
    if (!response.ok) return { kind: "error", status: response.status };
    return { kind: "ok" };
  } catch {
    return { kind: "error", status: 503 };
  }
}

export async function fetchOrder(id: string): Promise<FetchOrderResult> {
  if (!guidPattern.test(id)) return { kind: "notFound" };

  try {
    const response = await authFetch(`/api/orders/${encodeURIComponent(id)}`, { method: "GET" });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 404) return { kind: "notFound" };
    if (!response.ok) return { kind: "error" };

    const body: unknown = await response.json();
    return isOrderDetail(body) ? { kind: "ok", order: { ...body, bankTransfer: body.bankTransfer ?? null } } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

function isOrderSummary(value: unknown): value is OrderSummary {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<OrderSummary>;
  return typeof order.id === "string"
    && typeof order.orderNumber === "string"
    && typeof order.status === "string"
    && typeof order.paymentMethod === "string"
    && typeof order.total === "number"
    && typeof order.date === "string"
    && typeof order.totalItems === "number";
}