import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FallSim — Laboratoire de chute libre",
  description:
    "Une expérience interactive pour comprendre la chute libre et le mouvement horizontal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
