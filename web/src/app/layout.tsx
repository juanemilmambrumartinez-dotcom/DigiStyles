import type { Metadata } from "next";
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AmbientBackground } from "@/components/AmbientBackground";
import { brand } from "@/config/brand.config";
import "./globals.css";

const displayFont = Archivo_Black({
  variable: "--font-digistyles-display",
  subsets: ["latin"],
  weight: "400",
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-digistyles-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DigiStyles",
  description: "Tienda urbana de ropa, tenis y accesorios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeStyle = {
    "--brand-background": brand.colores.fondo,
    "--brand-surface": brand.colores.superficie,
    "--brand-divider": brand.colores.divisor,
    "--brand-text": brand.colores.texto,
    "--brand-text-soft": brand.colores.textoSuave,
    "--brand-accent": brand.colores.acento,
    "--brand-accent-hover": brand.colores.acentoHover,
    "--brand-secondary": brand.colores.secundario,
    "--brand-border-width": `${brand.forma.bordePx}px`,
    "--brand-radius": `${brand.forma.radioPx}px`,
    "--brand-shadow-x": `${brand.forma.sombraXpx}px`,
    "--brand-shadow-y": `${brand.forma.sombraYpx}px`,
    "--motion-fast": `${brand.movimiento.duracionRapidaMs}ms`,
    "--motion-medium": `${brand.movimiento.duracionMediaMs}ms`,
    "--motion-enter": `${brand.movimiento.duracionEntradaMs}ms`,
    "--motion-ease-out": brand.movimiento.easingSalida,
    "--motion-ease-in": brand.movimiento.easingEntrada,
    "--motion-distance-hover": `${brand.movimiento.distanciaHoverPx}px`,
    "--motion-distance-press": `${brand.movimiento.distanciaPressPx}px`,
    "--motion-ambient": `${brand.movimiento.duracionAmbientalS}s`,
    "--motion-ambient-secondary": `${brand.movimiento.duracionAmbientalSecundariaS}s`,
    "--motion-marquee": `${brand.movimiento.duracionMarquesinaS}s`,
    "--brand-glass-bg": brand.cristal.fondo,
    "--brand-glass-fallback": brand.cristal.fondoFallback,
    "--brand-glass-border": brand.cristal.borde,
    "--brand-glass-light": brand.cristal.luz,
    "--brand-glass-highlight": brand.cristal.brilloInterno,
    "--brand-glass-shadow": brand.cristal.sombraInterna,
    "--brand-glass-blur": `${brand.cristal.desenfoquePx}px`,
    "--brand-glass-blur-mobile": `${brand.cristal.desenfoqueMovilPx}px`,
    "--brand-glass-saturation": `${brand.cristal.saturacion}%`,
  } as React.CSSProperties;

  return (
    <html
      lang="es"
      className={`${displayFont.variable} ${monoFont.variable} h-full antialiased`}
      style={themeStyle}
    >
      <body className="flex min-h-full flex-col">
        <AmbientBackground />
        <Suspense fallback={<div className="liquid-glass h-16" />}>
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
