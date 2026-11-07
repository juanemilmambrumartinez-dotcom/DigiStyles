export const ACCESS_TOKEN_COOKIE = "digistyles_access_token";
export const REFRESH_TOKEN_COOKIE = "digistyles_refresh_token";

const REFRESH_TOKEN_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export type AuthCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires?: Date;
  maxAge?: number;
};

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

function toDate(value: string): Date {
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("La fecha de expiracion del token no es valida.");
  }
  return expiresAt;
}

export function accessTokenCookieOptions(expiresAtUtc: string): AuthCookieOptions {
  const expires = toDate(expiresAtUtc);
  const maxAge = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    expires,
    maxAge,
  };
}

export function refreshTokenCookieOptions(now = new Date()): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/api/auth",
    expires: new Date(now.getTime() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000),
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  };
}

export function expiredAccessTokenCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

export function expiredRefreshTokenCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/api/auth",
    expires: new Date(0),
    maxAge: 0,
  };
}