import { apiProxyErrorResponse, proxyApiRequest } from "@/lib/server/auth-bff";
import { noStoreJson } from "@/lib/server/auth-request";

export async function GET(request: Request) {
  try {
    const result = await proxyApiRequest("/api/checkout/info", request);
    if (result.status >= 500) return apiProxyErrorResponse();
    return noStoreJson(result.body, result.status);
  } catch {
    return apiProxyErrorResponse();
  }
}
