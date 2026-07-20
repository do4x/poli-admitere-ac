import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signOutAction } from "./auth/actions";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const days = daysUntilExam();
  const user = await getSessionUser();
  // The in-site nudge for AI marks past their 72h window. A count is a few
  // bytes of egress; redemption/independent uploads stamp redeemedAt, so this
  // needs no joins.
  const redoCount = user
    ? await prisma.aiMark.count({
        where: {
          userId: user.id,
          redeemedAt: null,
          dueAt: { lte: new Date() },
        },
      })
    : 0;
  return (
    <html lang="ro" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:gap-x-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-soft">
                ∂
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">
                Departaj
              </span>
            </Link>
            <Nav
              user={user && { email: user.email, isAdmin: user.isAdmin }}
              redoCount={redoCount}
            />
            <div className="ml-auto hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted shadow-soft sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span className="font-semibold text-ink tabular-nums">{days}</span>
              zile până la examen
            </div>
            {user ? (
              <form action={signOutAction} className="ml-auto sm:ml-0">
                <button
                  type="submit"
                  title={user.email}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-line/60 hover:text-ink"
                >
                  Ieșire
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="ml-auto rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 sm:ml-0"
              >
                Intră
              </Link>
            )}
          </div>
        </header>
        {/* No max-width here: each page owns its measure, so a reading
            surface like /revizuire can use the full width of a wide screen
            while the rest stay at max-w-5xl. */}
        <main className="w-full px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl border-t border-line/60 px-4 py-6 text-xs text-faint">
          Enunțurile provin din subiectele oficiale de admitere UPB, publicate
          public. Aplicație independentă, fără afiliere cu universitatea.
        </footer>
      </body>
    </html>
  );
}
