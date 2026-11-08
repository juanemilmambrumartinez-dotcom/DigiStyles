const fallbackDestination = "/cuenta";

export function safeNext(destination: string | null | undefined): string {
  if (!destination || !destination.startsWith("/") || destination.startsWith("//")
    || destination.includes("\\") || destination.includes("://")
    || /[\u0000-\u001F\u007F]/.test(destination)) {
    return fallbackDestination;
  }
  return destination;
}

// Válido: /cuenta.
// Inválidos: //evil.com, /\evil.com, https://evil.com y vacío.