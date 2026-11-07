import { cookies } from "next/headers";
import { authServerErrorResponse, postAuthApi, removeRefreshEntriesForNewToken } from "@/lib/server/auth-bff";
import {
  expiredAccessTokenCookieOptions,
  expiredRefreshTokenCookieOptions,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/server/auth-cookies";
import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";

export async function POST(request: Request) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    let apiFailure: Response | null = null;
    if (refreshToken) {
      const result = await postAuthApi<null>("/api/auth/logout", request, { refreshToken });
      if (result.status === 429) {
        apiFailure = noStoreJson({ message: result.message ?? "Demasiadas solicitudes." }, 429);
      } else if (result.status >= 500) {
        apiFailure = noStoreJson({ message: "El servicio de autenticacion no esta disponible." }, 503);
      }
      removeRefreshEntriesForNewToken(refreshToken);
    }

    cookieStore.set(ACCESS_TOKEN_COOKIE, "", expiredAccessTokenCookieOptions());
    cookieStore.set(REFRESH_TOKEN_COOKIE, "", expiredRefreshTokenCookieOptions());
    if (apiFailure) return apiFailure;
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authServerErrorResponse(error);
  }
}