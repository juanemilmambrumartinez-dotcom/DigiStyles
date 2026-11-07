export class AuthConfigurationError extends Error {
  constructor() {
    super("La autenticacion no esta configurada.");
    this.name = "AuthConfigurationError";
  }
}

export function validateAuthPostRequest(request: Request): Response | null {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) throw new AuthConfigurationError();

  if (request.headers.get("origin") !== webOrigin) {
    return Response.json(
      { message: "Solicitud no permitida." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json(
      { message: "El contenido debe ser JSON." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

export function noStoreJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}