import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Caveat, Instrument_Serif, Permanent_Marker } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// Self-hosted through next/font: production CSP is `font-src 'self'`, so a
// webfont CDN (fonts.gstatic.com) would be blocked outright. next/font emits
// the faces under /_next/static/media and a same-origin stylesheet, both of
// which satisfy `font-src 'self'` and `style-src 'self'`.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

// Handwriting for the injury cast only (ADR-084), so neither face is preloaded.
const caveat = Caveat({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-hand",
  display: "swap",
  preload: false,
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marker",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Kelderklasse Ultimate Team",
  description: "A live football-card game for Terrible Football Haarlem.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSerif.variable} ${caveat.variable} ${permanentMarker.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
