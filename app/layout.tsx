import type { Metadata } from "next";
import "./globals.css";
import { coupleName } from "@/lib/wedding";

export const metadata: Metadata = {
  title: `${coupleName} | Zdjęcia z wesela`,
  description: "Prywatna aplikacja do zbierania i oglądania zdjęć z wesela.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
