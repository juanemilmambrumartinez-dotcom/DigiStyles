import { cookies } from "next/headers";
import { authServerErrorResponse, getAuthApi, type AuthUser } from "@/lib/server/auth-bff";
import { ACCESS_TOKEN_COOKIE } from "@/lib/server/auth-cookies";
import { noStoreJson } from "@/lib/server/auth-request";

export async function GET(request: Request) {
  try {
    const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!accessToken) return noStoreJson({ message: "No autenticado." }, 401);

    const result = await getAuthApi<AuthUser>("/api/auth/me", request, accessToken);
    if (!result.data) {
      const status = result.status >= 500 ? 503 : result.status;
      return noStoreJson({ message: result.status === 401
        ? "No autenticado."
        : result.status >= 500
          ? "El servicio de autenticacion no esta disponible."
          : result.message ?? "No se pudo obtener la sesión." }, status);
    }

    return noStoreJson({ user: result.data });
  } catch (error) {
    return authServerErrorResponse(error);
  }
}