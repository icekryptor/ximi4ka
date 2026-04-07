import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XimiLearn — Химия для школьников",
  description: "Образовательная платформа по химии от Ximi4ka. Теория, реакции, задачи из школьной программы.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans text-text-dark bg-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
