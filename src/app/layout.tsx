import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kelderklasse Ultimate Team",
  description: "A live football-card game for Terrible Football Haarlem.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
