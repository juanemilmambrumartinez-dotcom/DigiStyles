import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";
import {
  adminApiResponse,
  adminBffErrorResponse,
  getAdminAccessToken,
  invalidOrderIdResponse,
  isAdminOrderStatus,
  isOrderId,
  proxyApiRequest,
  readBodyWithLimit,
} from "@/lib/admin-bff";

type OrderRouteContext = { params: Promise<{ id: string }> };
const MAX_BODY_BYTES = 1024;

export async function POST(request: Request, context: OrderRouteContext) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const { id } = await context.params;
    if (!isOrderId(id)) return invalidOrderIdResponse();

    const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
    if (body === null) {
      return noStoreJson({ code: "solicitud_invalida", message: "El cuerpo de la solicitud no puede superar 1 KB." }, 400);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return noStoreJson({ code: "solicitud_invalida", message: "El cuerpo debe ser un JSON válido." }, 400);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return noStoreJson({ code: "solicitud_invalida", message: "El cuerpo debe contener únicamente el campo status." }, 400);
    }

    const entries = Object.entries(parsed);
    const status = entries.length === 1 && entries[0][0] === "status" ? entries[0][1] : null;
    if (!isAdminOrderStatus(status)) {
      return noStoreJson({ code: "solicitud_invalida", message: "El estado no es válido." }, 400);
    }

    const accessToken = await getAdminAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    return adminApiResponse(await proxyApiRequest(`/api/admin/orders/${id}/status`, request, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json" },
    }));
  } catch {
    return adminBffErrorResponse();
  }
}