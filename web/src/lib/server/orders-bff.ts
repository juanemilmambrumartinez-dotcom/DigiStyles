import { cookies } from "next/headers";
import { apiProxyErrorResponse, type ApiProxyResult } from "./auth-bff";
import { ACCESS_TOKEN_COOKIE } from "./auth-cookies";
import { noStoreJson } from "./auth-request";

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrderAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function isOrderId(value: string): boolean {
  return GUID_PATTERN.test(value);
}

export function orderApiResponse(result: ApiProxyResult): Response {
  if (result.status >= 500) return apiProxyErrorResponse();
  if (result.status === 401) return noStoreJson({ message: "No autenticado." }, 401);
  return noStoreJson(result.body, result.status);
}

export function invalidOrderIdResponse(): Response {
  return noStoreJson({ message: "El pedido no existe." }, 404);
}

export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}