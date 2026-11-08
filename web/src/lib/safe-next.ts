const fallbackDestination = "/cuenta";

export function safeNext(destination: string | null | undefined): string {
  if (!destination || !destination.startsWith("/") || destination.startsWith("//")
    || destination.includes("\\") || destination.includes("://")
    || /[\u0000-\u001F\u007F]/.test(destination)) {
    return fallbackDestination;
  }
  if (destination === "/ingresar" || destination === "/registro"
    || destination.startsWith("/ingresar?") || destination.startsWith("/registro?")) {
    return fallbackDestination;
  }
  return destination;
}

// Válido: /cuenta y otras rutas internas seguras.
// Redirige a /cuenta: /ingresar, /registro y sus variantes con consulta.
// También son inválidos: //evil.com, /\evil.com, https://evil.com y vacío.