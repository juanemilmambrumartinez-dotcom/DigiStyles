import { apiProxyErrorResponse, proxyApiRequest } from "@/lib/server/auth-bff";
import { noStoreJson } from "@/lib/server/auth-request";
import {
  getOrderAccessToken,
  invalidOrderIdResponse,
  isOrderId,
  orderApiResponse,
} from "@/lib/server/orders-bff";

type OrderRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: OrderRouteContext) {
  try {
    const { id } = await context.params;
    if (!isOrderId(id)) return invalidOrderIdResponse();

    const accessToken = await getOrderAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    return orderApiResponse(await proxyApiRequest(`/api/orders/${id}`, request, {
      method: "GET",
      accessToken,
    }));
  } catch {
    return apiProxyErrorResponse();
  }
}
