export interface AuthFetchOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
}

let refreshPromise: Promise<Response> | null = null;
const authEndpointPrefixes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/refresh",
];

function requestOptions(options: RequestInit = {}): RequestInit {
  return {
    ...options,
    cache: "no-store",
    credentials: "include",
  };
}

function refreshOnce(): Promise<Response> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", requestOptions({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  return authEndpointPrefixes.some((prefix) => url.startsWith(prefix));
}

export async function authFetch(input: RequestInfo | URL, options: AuthFetchOptions = {}): Promise<Response> {
  const { retryOnUnauthorized = true, ...fetchOptions } = options;
  const response = await fetch(input, requestOptions(fetchOptions));
  if (response.status !== 401 || !retryOnUnauthorized || isAuthEndpoint(input)) return response;

  const refreshResponse = await refreshOnce();
  if (!refreshResponse.ok) return response;

  return fetch(input, requestOptions(fetchOptions));
}

export async function refreshSession(): Promise<Response> {
  return refreshOnce();
}