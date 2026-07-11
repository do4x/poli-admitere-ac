import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Departaj",
  description: "UPB admitere — probleme de departajare, rezolvate singur.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className="min-h-screen">
        <header className="border-b border-stone-300 bg-white">
          <nav className="mx-auto flex max-w-5xl items-baseline gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Departaj
            </Link>
            <Link
              href="/exams"
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Examene
            </Link>
            <Link
              href="/probleme"
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Probleme
            </Link>
            <Link
              href="/import"
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Import
            </Link>
            <span className="ml-auto text-xs text-stone-400">
              examen: 24 iulie 2026
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
