export const brand = {
  nombre: "DigiStyles",
  eslogan: "Streetwear con actitud.",
  monedaBase: "DOP",
  monedaPredeterminada: "DOP",
  logo: {
    src: "/logo.svg",
    alt: "JVM / DigiStyles",
    width: 180,
    height: 64,
  },
  // Tasas de ejemplo: deben actualizarse manualmente antes de publicar.
  ratesUpdatedAt: "2026-10-22",
  monedas: {
    DOP: { codigo: "DOP", simbolo: "RD$", locale: "es-DO", tasaDesdeDop: 1 },
    USD: { codigo: "USD", simbolo: "US$", locale: "en-US", tasaDesdeDop: 0.017 },
    EUR: { codigo: "EUR", simbolo: "€", locale: "es-ES", tasaDesdeDop: 0.016 },
  },
  colores: {
    fondo: "#090909",
    superficie: "#151515",
    acento: "#d8ff3e",
    texto: "#f5f5f5",
    textoSuave: "#a3a3a3",
  },
  tipografia: {
    titular: "var(--font-digistyles-display)",
    mono: "var(--font-digistyles-mono)",
  },
  forma: {
    bordePx: 2,
    radioPx: 0,
    sombraXpx: 6,
    sombraYpx: 6,
  },
  cristal: {
    desenfoquePx: 12,
    desenfoqueMovilPx: 6,
    fondo: "rgba(9, 9, 9, 0.88)",
    fondoFallback: "#090909",
    borde: "rgba(245, 245, 245, 0.28)",
    maximoVisible: 3,
  },
  textos: {
    estado: "La tienda está en preparación",
    descripcion: "Base del proyecto configurada y lista para construir el catálogo.",
  },
} as const;


