import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialWawe — Instagram Otomatik Video & Reels Zamanlama Platformu",
  description:
    "Instagram hesaplarınız için tekli ve toplu video/Reels yükleme, otomatik sıraya dizme ve zamanlama SaaS platformu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-[#090a0f] text-gray-100 antialiased selection:bg-pink-500/30 selection:text-pink-200">
        {children}
      </body>
    </html>
  );
}

