import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DeviceIdInitializer } from "@/components/DeviceIdInitializer";
import { InAppBrowserWarning } from "@/components/InAppBrowserWarning";
import { YandexMetrica } from "@/components/YandexMetrica";
import { CssLoadCheck } from "@/components/CssLoadCheck";

// Critical inline styles — applied even if the external Tailwind bundle
// fails to load (Yandex Browser turbo mode, aggressive ad-blockers, weird
// proxies). Keeps the page readable + buttons clickable as a last resort.
// Caught one Windows + Yandex Browser report where the user saw raw HTML;
// see the screenshot in commit history.
// All component-style rules wrapped in :where() → specificity = 0, so ANY
// Tailwind utility class (bg-transparent, text-primary, border-0 etc.)
// trivially overrides the fallback. Earlier version applied `background:
// #836efe; color: white` to every <button>, which collided with Tailwind's
// `text-primary` for in-component icon-style buttons (text became invisible
// purple-on-purple). With :where() the defaults only appear when no Tailwind
// class is on the element — exactly what we want for "CSS bundle failed".
const CRITICAL_CSS = `
  /* Reset bits */
  body { margin: 0; padding: 0; }
  * { box-sizing: border-box; }
  /* Readable base */
  html, body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #1c1528;
    background: #ffffff;
    -webkit-font-smoothing: antialiased;
  }
  :where(h1) { font-size: 2rem; font-weight: 700; line-height: 1.2; margin: 0 0 .5em; }
  :where(h2) { font-size: 1.5rem; font-weight: 700; line-height: 1.3; margin: 1.5em 0 .5em; }
  :where(h3) { font-size: 1.125rem; font-weight: 600; line-height: 1.4; margin: 1em 0 .3em; }
  :where(p)  { margin: 0 0 .75em; }
  /* Buttons — minimal usable defaults that Tailwind overrides on demand */
  :where(button),
  :where(a[role="button"]),
  :where(input[type="submit"]),
  :where(input[type="button"]) {
    font: inherit;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #e8e5ef;
    background: #836efe;
    color: white;
    font-weight: 600;
  }
  :where(button:hover) { opacity: 0.92; }
  :where(button:disabled) { opacity: 0.5; cursor: not-allowed; }
  /* Inputs visible */
  :where(input[type="text"], input[type="email"], input[type="password"],
         input[type="search"], input[type="tel"], textarea, select) {
    font: inherit;
    padding: 8px 12px;
    border: 1px solid #cbcbd5;
    border-radius: 8px;
    background: white;
    color: inherit;
  }
  /* Links — match brand */
  :where(a) { color: #836efe; }
  :where(a:hover) { color: #6a4ff5; }
  /* Containers — minimal padding so content isn't glued to edges */
  :where(main) { display: block; padding: 16px; max-width: 1200px; margin: 0 auto; }
`;

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
  applicationName: "XimiLearn",
  appleWebApp: {
    capable: true,
    title: "XimiLearn",
    statusBarStyle: "default",
  },
};

// Viewport — set viewportFit=cover for iPhone notch handling + theme-color
// for mobile browser chrome (Yandex Browser, Chrome on Android).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#836efe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Critical inline styles — fallback when external CSS bundle fails */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      </head>
      <body className="font-sans text-text-primary bg-bg-base min-h-screen flex flex-col antialiased">
        <InAppBrowserWarning />
        <DeviceIdInitializer />
        <CssLoadCheck />
        {children}
        <YandexMetrica />
      </body>
    </html>
  );
}
