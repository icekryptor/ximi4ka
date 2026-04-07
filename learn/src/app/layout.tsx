import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XimiLearn — Химия для школьников",
  description: "Образовательная платформа по химии от Ximi4ka. Теория, реакции, задачи из школьной программы.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans text-gray-100 bg-bg-dark min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
