import { apiProxyErrorResponse, proxyApiRequest } from "@/lib/server/auth-bff";
import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";
import {
  getOrderAccessToken,
  invalidOrderIdResponse,
  isOrderId,
  orderApiResponse,
} from "@/lib/server/orders-bff";

type OrderRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: OrderRouteContext) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const { id } = await context.params;
    if (!isOrderId(id)) return invalidOrderIdResponse();

    const accessToken = await getOrderAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    return orderApiResponse(await proxyApiRequest(`/api/orders/${id}/cancel`, request, {
      method: "POST",
      accessToken,
    }));
  } catch {
    return apiProxyErrorResponse();
  }
}
