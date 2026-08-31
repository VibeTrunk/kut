import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Instrument_Serif } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Kelderklasse Ultimate Team",
  description: "A live football-card game for Terrible Football Haarlem.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();

  return (
    <html lang="en" className={`${archivo.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
