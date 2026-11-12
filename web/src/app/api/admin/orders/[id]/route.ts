import { noStoreJson } from "@/lib/server/auth-request";
import {
  adminApiResponse,
  adminBffErrorResponse,
  getAdminAccessToken,
  invalidOrderIdResponse,
  isOrderId,
  proxyApiRequest,
} from "@/lib/admin-bff";

type OrderRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: OrderRouteContext) {
  try {
    const { id } = await context.params;
    if (!isOrderId(id)) return invalidOrderIdResponse();

    const accessToken = await getAdminAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    return adminApiResponse(await proxyApiRequest(`/api/admin/orders/${id}`, request, {
      method: "GET",
      accessToken,
    }));
  } catch {
    return adminBffErrorResponse();
  }
}