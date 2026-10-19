import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";

import "./globals.css";

/**
 * Fonts are self-hosted by next/font at build time: no runtime request to a
 * third party, no layout shift from a late swap, and no data leaving the page
 * to load a typeface. `latin-ext` is required - without it the Turkish ğ, ş
 * and ı fall back to a different family mid-word.
 */
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Daylight",
    template: "%s · Daylight",
  },
  description: "A clearer view of your money.",
  applicationName: "Daylight",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={`${newsreader.variable} ${manrope.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
