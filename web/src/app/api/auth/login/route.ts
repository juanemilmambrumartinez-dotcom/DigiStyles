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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ message: "Solicitud no válida." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return noStoreJson({ message: "Solicitud no válida." }, 400);
    }

    const { email, password } = body as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string") {
      return noStoreJson({ message: "Solicitud no válida." }, 400);
    }

    const result = await postAuthApi<AuthResponse>("/api/auth/login", request, { email, password });
    if (!result.data) {
      const status = result.status >= 500 ? 503 : result.status;
      return noStoreJson({ message: result.status === 401
        ? "Correo o contraseña incorrectos."
        : result.status >= 500
          ? "El servicio de autenticacion no esta disponible."
          : result.message ?? "No se pudo iniciar sesión." }, status);
    }

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_TOKEN_COOKIE, result.data.accessToken, accessTokenCookieOptions(result.data.accessTokenExpiresAtUtc));
    cookieStore.set(REFRESH_TOKEN_COOKIE, result.data.refreshToken, refreshTokenCookieOptions());
    return noStoreJson({ user: result.data.user });
  } catch (error) {
    return authServerErrorResponse(error);
  }
}