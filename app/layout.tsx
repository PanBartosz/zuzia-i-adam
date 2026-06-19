import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zuzia & Adam | Zdjęcia z wesela",
  description: "Prywatna aplikacja do zbierania i oglądania zdjęć z wesela.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full bg-[#f7f1e7] text-[#3c2c22]">{children}</body>
    </html>
  );
}
