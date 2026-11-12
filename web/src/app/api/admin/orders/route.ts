import { noStoreJson } from "@/lib/server/auth-request";
import {
  adminApiResponse,
  adminBffErrorResponse,
  getAdminAccessToken,
  isAdminOrderStatus,
  proxyApiRequest,
} from "@/lib/admin-bff";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    if (status !== null && !isAdminOrderStatus(status)) {
      return noStoreJson({ code: "solicitud_invalida", message: "El estado no es válido." }, 400);
    }

    const accessToken = await getAdminAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    const path = status === null ? "/api/admin/orders" : `/api/admin/orders?status=${encodeURIComponent(status)}`;
    return adminApiResponse(await proxyApiRequest(path, request, { method: "GET", accessToken }));
  } catch {
    return adminBffErrorResponse();
  }
}