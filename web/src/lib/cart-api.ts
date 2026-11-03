import type { StoredCartLine } from "@/lib/cart-storage";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export interface CartLineRequest {
  variantId: number;
  quantity: number;
}

export interface CartLineResponse {
  variantId: number;
  productId: number | null;
  slug: string | null;
  productName: string | null;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  requestedQuantity: number;
  acceptedQuantity: number;
  unitPrice: number | null;
  lineSubtotal: number;
  status: string;
  message: string;
}

export interface CartValidationResponse {
  lines: CartLineResponse[];
  total: number;
}

function apiUrl(path: string) {
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_URL no está configurada.");
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

function isBadRequestError(error: unknown): error is Error {
  return error instanceof Error && error.name === "CartValidationError";
}

export async function validateCart(lines: StoredCartLine[]): Promise<CartValidationResponse> {
  try {
    const response = await fetch(apiUrl("/api/cart/validate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lines),
    });

    if (response.status === 400) {
      let message = "El carrito no es válido.";
      try {
        const body: unknown = await response.json();
        if (typeof body === "string" && body.trim()) message = body.trim();
      } catch {}
      const error = new Error(message || "El carrito no es válido.");
      error.name = "CartValidationError";
      throw error;
    }

    if (!response.ok) {
      throw new Error("No se pudo validar el carrito.");
    }

    return await response.json() as CartValidationResponse;
  } catch (error) {
    if (isBadRequestError(error)) throw error;
    if (error instanceof Error && error.message === "NEXT_PUBLIC_API_URL no está configurada.") {
      throw error;
    }
    throw new Error("No se pudo validar el carrito. Comprueba tu conexión e inténtalo de nuevo.");
  }
}