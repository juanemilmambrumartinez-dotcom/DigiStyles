import "server-only";

import { createHash } from "node:crypto";
import { getClientIp } from "./client-ip";
import { AuthConfigurationError, noStoreJson } from "./auth-request";

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_CACHE_TTL_MS = 5_000;

export interface AuthUser {
  email: string;
  name: string;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  user: AuthUser;
}

export interface AuthApiResult<T> {
  status: number;
  data: T | null;
  message: string | null;
}

export interface RefreshResult {
  api: AuthApiResult<AuthResponse>;
  replayed: boolean;
}

interface RecentRefreshEntry {
  presentedTokenHash: string;
  newTokenHash: string;
  response: AuthResponse;
  expiresAt: number;
}

const recentRefreshes = new Map<string, RecentRefreshEntry>();
const refreshFlights = new Map<string, Promise<RefreshResult>>();

function requiredEnvironment(name: "INTERNAL_API_KEY" | "NEXT_PUBLIC_API_URL"): string {
  const value = process.env[name];
  if (!value) throw new AuthConfigurationError();
  return value;
}

function refreshCacheTtlMs(): number {
  const configured = Number(process.env.AUTH_REFRESH_CACHE_TTL_MS ?? DEFAULT_REFRESH_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 && configured < 10_000
    ? configured
    : DEFAULT_REFRESH_CACHE_TTL_MS;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function pruneRecentRefreshes(now = Date.now()): void {
  for (const [presentedHash, entry] of recentRefreshes) {
    if (entry.expiresAt <= now) recentRefreshes.delete(presentedHash);
  }
}

function apiUrl(path: string): string {
  return `${requiredEnvironment("NEXT_PUBLIC_API_URL").replace(/\/$/, "")}${path}`;
}

function apiHeaders(request: Request, includeJson = false): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "X-Internal-Key": requiredEnvironment("INTERNAL_API_KEY"),
  });
  const clientIp = getClientIp(request);
  if (clientIp) headers.set("X-Client-IP", clientIp);
  if (includeJson) headers.set("Content-Type", "application/json");
  return headers;
}

async function fetchApi(path: string, request: Request, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = apiHeaders(request, init.body !== undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  try {
    return await fetch(apiUrl(path), {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
  } catch {
    throw new Error("AUTH_API_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

async function readApiResult<T>(response: Response): Promise<AuthApiResult<T>> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
  return {
    status: response.status,
    data: response.ok ? body as T : null,
    message: typeof record?.message === "string" ? record.message : null,
  };
}

export async function postAuthApi<T>(path: string, request: Request, body: unknown): Promise<AuthApiResult<T>> {
  return readApiResult<T>(await fetchApi(path, request, {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

export async function getAuthApi<T>(path: string, request: Request, accessToken: string): Promise<AuthApiResult<T>> {
  return readApiResult<T>(await fetchApi(path, request, {
    method: "GET",
    headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
  }));
}

async function rotateRefreshToken(request: Request, presentedToken: string, presentedTokenHash: string): Promise<RefreshResult> {
  const api = await postAuthApi<AuthResponse>("/api/auth/refresh", request, { refreshToken: presentedToken });
  if (api.status === 200 && api.data) {
    const entry: RecentRefreshEntry = {
      presentedTokenHash,
      newTokenHash: hashToken(api.data.refreshToken),
      response: api.data,
      expiresAt: Date.now() + refreshCacheTtlMs(),
    };
    recentRefreshes.set(presentedTokenHash, entry);
  }
  return { api, replayed: false };
}

export async function refreshAuth(request: Request, presentedToken: string): Promise<RefreshResult> {
  pruneRecentRefreshes();
  const presentedTokenHash = hashToken(presentedToken);
  const recent = recentRefreshes.get(presentedTokenHash);
  if (recent) return {
    api: { status: 200, data: recent.response, message: null },
    replayed: true,
  };

  const existingFlight = refreshFlights.get(presentedTokenHash);
  if (existingFlight) return existingFlight;

  const flight = rotateRefreshToken(request, presentedToken, presentedTokenHash);
  refreshFlights.set(presentedTokenHash, flight);
  try {
    return await flight;
  } finally {
    refreshFlights.delete(presentedTokenHash);
    pruneRecentRefreshes();
  }
}

export function wasRecentlyRotated(presentedToken: string): boolean {
  pruneRecentRefreshes();
  return recentRefreshes.has(hashToken(presentedToken));
}

export function removeRefreshEntriesForNewToken(refreshToken: string): void {
  const newTokenHash = hashToken(refreshToken);
  for (const [presentedHash, entry] of recentRefreshes) {
    if (entry.newTokenHash === newTokenHash) recentRefreshes.delete(presentedHash);
  }
}

export function authServerErrorResponse(error: unknown): Response {
  if (error instanceof AuthConfigurationError) {
    return noStoreJson({ message: "La autenticacion no esta disponible." }, 500);
  }

  if (error instanceof Error && error.message === "AUTH_API_UNAVAILABLE") {
    return noStoreJson({ message: "El servicio de autenticacion no esta disponible." }, 503);
  }

  return noStoreJson({ message: "No se pudo procesar la solicitud." }, 500);
}