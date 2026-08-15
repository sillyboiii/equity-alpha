import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";

const brandSerif = Newsreader({
  variable: "--font-brand-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const brandSans = Inter({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Equity Alpha — Research that respects the trend",
  description:
    "Trend-first equity research. No falling knives, no pumping short squeezes, no paying premium for the trend — with a verifiable track record.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${brandSerif.variable} ${brandSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
