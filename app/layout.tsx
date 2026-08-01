import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FallSim — Laboratoire de chute libre",
  description:
    "Une expérience interactive pour comprendre la chute libre et le mouvement horizontal.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
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
