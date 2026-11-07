import { cookies } from "next/headers";
import { authServerErrorResponse, postAuthApi, type AuthResponse } from "@/lib/server/auth-bff";
import {
  accessTokenCookieOptions,
  ACCESS_TOKEN_COOKIE,
  refreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/server/auth-cookies";
import { noStoreJson, validateAuthPostRequest } from "@/lib/server/auth-request";

export async function POST(request: Request) {
  try {
    const requestError = validateAuthPostRequest(request);
    if (requestError) return requestError;

    const result = await postAuthApi<AuthResponse>("/api/auth/register", request, await request.json());
    if (!result.data) {
      return noStoreJson({ message: result.message ?? "No se pudo crear la cuenta." }, result.status);
    }

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_TOKEN_COOKIE, result.data.accessToken, accessTokenCookieOptions(result.data.accessTokenExpiresAtUtc));
    cookieStore.set(REFRESH_TOKEN_COOKIE, result.data.refreshToken, refreshTokenCookieOptions());
    return noStoreJson({ user: result.data.user });
  } catch (error) {
    return authServerErrorResponse(error);
  }
}