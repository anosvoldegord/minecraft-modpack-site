import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "ModBuilder — Сборщик модов для Minecraft",
  description: "Создавайте, собирайте и делитесь сборками модов для Minecraft. Поиск модов, автоподтягивание библиотек, каталог сборок и многое другое.",
  keywords: ["minecraft", "моды", "сборки", "modbuilder", "майнкрафт", "модпаки"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}      </body>
    </html>
  );
}// force update 11/06/2026 23:01:40
