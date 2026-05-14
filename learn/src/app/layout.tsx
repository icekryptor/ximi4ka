import type { Metadata } from "next";
import { Manrope, Unbounded, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DeviceIdInitializer } from "@/components/DeviceIdInitializer";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XimiLearn — химия это просто",
  description: "Интерактивная платформа для изучения химии",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans text-text-primary bg-bg-base min-h-screen flex flex-col antialiased">
        <DeviceIdInitializer />
        {children}
      </body>
    </html>
  );
}
