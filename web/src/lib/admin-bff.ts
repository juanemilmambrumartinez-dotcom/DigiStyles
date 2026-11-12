import { apiProxyErrorResponse, type ApiProxyResult, proxyApiRequest } from "@/lib/server/auth-bff";
import { noStoreJson } from "@/lib/server/auth-request";
import { getOrderAccessToken, invalidOrderIdResponse, isOrderId, readBodyWithLimit } from "@/lib/server/orders-bff";

export const ADMIN_ORDER_STATUSES = ["Pendiente", "Confirmado", "Enviado", "Entregado", "Cancelado"] as const;
export type AdminOrderStatus = typeof ADMIN_ORDER_STATUSES[number];

export function isAdminOrderStatus(value: unknown): value is AdminOrderStatus {
  return typeof value === "string" && ADMIN_ORDER_STATUSES.includes(value as AdminOrderStatus);
}

function safeErrorBody(result: ApiProxyResult): { code: string; message: string } {
  const body = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : null;
  return {
    code: typeof body?.code === "string" ? body.code : "solicitud_invalida",
    message: typeof body?.message === "string" ? body.message : "No se pudo procesar la solicitud.",
  };
}

export function adminApiResponse(result: ApiProxyResult): Response {
  if (result.status >= 500) return apiProxyErrorResponse();
  if (result.status === 401) return noStoreJson({ message: "No autenticado." }, 401);
  if (result.status === 200) return noStoreJson(result.body, 200);
  if ([400, 403, 404, 409, 429].includes(result.status)) {
    return noStoreJson(safeErrorBody(result), result.status);
  }
  return noStoreJson({ message: "No se pudo procesar la solicitud." }, 503);
}

export function adminBffErrorResponse(): Response {
  return apiProxyErrorResponse();
}

export async function getAdminAccessToken(): Promise<string | null> {
  return getOrderAccessToken();
}

export { invalidOrderIdResponse, isOrderId, readBodyWithLimit, proxyApiRequest };