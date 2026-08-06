import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "AccessDiff — AI Accessibility Copilot for GitHub",
  description:
    "AI-powered Accessibility Engineering Platform that performs Accessibility Regression Analysis on GitHub repositories. Detect only newly introduced accessibility issues.",
  keywords: [
    "accessibility",
    "WCAG",
    "GitHub",
    "AI",
    "regression analysis",
    "a11y",
  ],
  openGraph: {
    type: "website",
    title: "AccessDiff — AI Accessibility Copilot for GitHub",
    description: "Catch newly introduced WCAG regressions before they ship.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
