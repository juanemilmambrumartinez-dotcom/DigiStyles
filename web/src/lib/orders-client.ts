import { authFetch } from "@/lib/auth-client";
import { formatPrice } from "@/lib/currency";

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

export type FetchOrderResult =
  | { kind: "ok"; order: OrderDetail }
  | { kind: "notFound" }
  | { kind: "unauthenticated" }
  | { kind: "error" };

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