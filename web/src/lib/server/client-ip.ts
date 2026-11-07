import { isIP } from "node:net";

function validIp(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized && isIP(normalized) > 0 ? normalized : null;
}

export function getClientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return null;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0] ?? null;
  return validIp(forwardedFor) ?? validIp(request.headers.get("x-real-ip"));
}