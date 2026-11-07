import { cookies } from "next/headers";
import { authServerErrorResponse, refreshAuth, wasRecentlyRotated } from "@/lib/server/auth-bff";
import {
  accessTokenCookieOptions,
  ACCESS_TOKEN_COOKIE,
  expiredAccessTokenCookieOptions,
  expiredRefreshTokenCookieOptions,
  refreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/server/auth-cookies";
import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";

export async function POST(request: Request) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const cookieStore = await cookies();
    const presentedToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!presentedToken) {
      return noStoreJson({ message: "El refresh token no es válido." }, 401);
    }

    const result = await refreshAuth(request, presentedToken);
    if (result.api.data) {
      cookieStore.set(ACCESS_TOKEN_COOKIE, result.api.data.accessToken, accessTokenCookieOptions(result.api.data.accessTokenExpiresAtUtc));
      cookieStore.set(REFRESH_TOKEN_COOKIE, result.api.data.refreshToken, refreshTokenCookieOptions());
      return noStoreJson({ user: result.api.data.user });
    }

    if (result.api.status === 401 && !wasRecentlyRotated(presentedToken)) {
      cookieStore.set(ACCESS_TOKEN_COOKIE, "", expiredAccessTokenCookieOptions());
      cookieStore.set(REFRESH_TOKEN_COOKIE, "", expiredRefreshTokenCookieOptions());
    }

    const status = result.api.status >= 500 ? 503 : result.api.status;
    const message = result.api.status >= 500
      ? "El servicio de autenticacion no esta disponible."
      : result.api.message ?? "El refresh token no es válido.";
    return noStoreJson({ message }, status);
  } catch (error) {
    return authServerErrorResponse(error);
  }
}