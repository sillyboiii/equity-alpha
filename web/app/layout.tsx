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
  title: "QNTL | Research that respects the trend",
  description:
    "QNTL scores long-term trends against a valuation guardrail. We never buy a falling knife, never overpay, and log every call to a public ledger. No cherry-picking, just receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${brandSerif.variable} ${brandSans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("qntl:theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
