import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jassen",
  description: "Swiss Jass — Bieter, Schieber, Differenzler & Fuck Your Neighbour",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
