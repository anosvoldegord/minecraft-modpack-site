import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({ src: "./fonts/Inter-Regular.woff2", display: "swap" });

export const metadata: Metadata = {
  title: "ModBuilder — Сборщик модов для Minecraft",
  description: "Создавайте, публикуйте и скачивайте сборки модов для Minecraft прямо в браузере.",
  verification: {
    yandex: "2deb386efa75c9bf",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}