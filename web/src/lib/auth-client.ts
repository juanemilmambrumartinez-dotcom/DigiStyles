export interface AuthFetchOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
}

let refreshPromise: Promise<Response> | null = null;

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

export async function authFetch(input: RequestInfo | URL, options: AuthFetchOptions = {}): Promise<Response> {
  const { retryOnUnauthorized = true, ...fetchOptions } = options;
  const response = await fetch(input, requestOptions(fetchOptions));
  if (response.status !== 401 || !retryOnUnauthorized) return response;

  const refreshResponse = await refreshOnce();
  if (!refreshResponse.ok) return response;

  return fetch(input, requestOptions(fetchOptions));
}

export async function refreshSession(): Promise<Response> {
  return refreshOnce();
}