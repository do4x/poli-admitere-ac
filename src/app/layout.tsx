import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Nav } from "./Nav";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Departaj",
  description: "UPB admitere — probleme de departajare, rezolvate singur.",
};

const EXAM_DATE = new Date("2026-07-24T00:00:00");

function daysUntilExam(): number {
  const now = new Date();
  const ms = EXAM_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const days = daysUntilExam();
  return (
    <html lang="ro" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-soft">
                ∂
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">
                Departaj
              </span>
            </Link>
            <Nav />
            <div className="ml-auto flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted shadow-soft">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span className="font-semibold text-ink tabular-nums">{days}</span>
              zile până la examen
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
