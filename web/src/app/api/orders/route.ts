import { apiProxyErrorResponse, proxyApiRequest } from "@/lib/server/auth-bff";
import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";
import { getOrderAccessToken, orderApiResponse, readBodyWithLimit } from "@/lib/server/orders-bff";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export async function GET(request: Request) {
  try {
    const accessToken = await getOrderAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    return orderApiResponse(await proxyApiRequest("/api/orders", request, {
      method: "GET",
      accessToken,
    }));
  } catch {
    return apiProxyErrorResponse();
  }
}

export async function POST(request: Request) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const accessToken = await getOrderAccessToken();
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    const MAX_BODY_BYTES = 16 * 1024;
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return noStoreJson({ message: "La cabecera Idempotency-Key no es válida." }, 400);
    }

       const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
    if (body === null) {
      return noStoreJson({ code: "cuerpo_demasiado_grande", message: "El cuerpo de la solicitud no puede superar los 16 KB." }, 413);
    }
    
    } catch {
      return noStoreJson({ message: "Solicitud no válida." }, 400);
    }

    return orderApiResponse(await proxyApiRequest("/api/orders", request, {
      method: "POST",
      accessToken,
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }));
  } catch {
    return apiProxyErrorResponse();
  }
}
