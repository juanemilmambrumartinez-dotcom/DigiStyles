export const CART_STORAGE_KEY = "digistyles-cart";

export const MAX_CART_LINES = 20;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

export interface StoredCartLine {
  variantId: number;
  quantity: number;
}

function isStoredCartLine(value: unknown): value is StoredCartLine {
  if (!value || typeof value !== "object") return false;

  const line = value as Partial<StoredCartLine>;
  return typeof line.variantId === "number"
    && Number.isInteger(line.variantId)
    && line.variantId > 0
    && typeof line.quantity === "number"
    && Number.isInteger(line.quantity)
    && line.quantity >= MIN_QUANTITY
    && line.quantity <= MAX_QUANTITY;
}

export function normalizeCartLines(value: unknown): StoredCartLine[] {
  if (!Array.isArray(value)) return [];

  const lines: StoredCartLine[] = [];
  for (const candidate of value) {
    if (!isStoredCartLine(candidate)) continue;

    const existingLine = lines.find((line) => line.variantId === candidate.variantId);
    if (existingLine) {
      existingLine.quantity = Math.min(MAX_QUANTITY, existingLine.quantity + candidate.quantity);
      continue;
    }

    if (lines.length < MAX_CART_LINES) {
      lines.push({ variantId: candidate.variantId, quantity: candidate.quantity });
    }
  }

  return lines;
}

export function readCart(): StoredCartLine[] {
  try {
    const storedValue = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedValue) return [];
    return normalizeCartLines(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

export function readCartValue(value: string | null): StoredCartLine[] {
  if (!value) return [];

  try {
    return normalizeCartLines(JSON.parse(value));
  } catch {
    return [];
  }
}

export function writeCart(lines: StoredCartLine[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizeCartLines(lines)));
  } catch {
    // localStorage puede no estar disponible en modo privado o con permisos restringidos.
  }
}