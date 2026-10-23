export const brand = {
  nombre: "DigiStyles",
  eslogan: "Streetwear con actitud.",
  monedaBase: "DOP",
  monedaPredeterminada: "DOP",
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
    principal: "var(--font-geist-sans)",
  },
  textos: {
    estado: "La tienda está en preparación",
    descripcion: "Base del proyecto configurada y lista para construir el catálogo.",
  },
} as const;
