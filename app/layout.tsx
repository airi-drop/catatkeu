import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CatatKeu",
  description: "Catatan keuangan sederhana untuk pribadi dan UMKM mikro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#0a0f14] antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#0a0f14]">{children}</body>
    </html>
  );
}
