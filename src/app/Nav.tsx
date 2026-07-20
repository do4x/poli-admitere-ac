"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavUser {
  email: string;
  isAdmin: boolean;
}

const LINKS: {
  href: string;
  label: string;
  exact?: boolean;
  requires?: "user" | "admin";
}[] = [
  { href: "/", label: "Panou", exact: true, requires: "user" },
  { href: "/exams", label: "Examene" },
  { href: "/probleme", label: "Probleme" },
  { href: "/revizuire", label: "Revizuire", requires: "user" },
  { href: "/import", label: "Import", requires: "admin" },
  { href: "/cont", label: "Cont", requires: "user" },
];

export function Nav({
  user,
  redoCount = 0,
}: {
  user: NavUser | null;
  /** Problems whose AI mark passed its re-solve window — badge on "Cont". */
  redoCount?: number;
}) {
  const pathname = usePathname();

  const visible = LINKS.filter((link) =>
    link.requires === "admin"
      ? user?.isAdmin
      : link.requires === "user"
        ? user !== null
        : true,
  );

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {visible.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        const href =
          link.href === "/cont" && redoCount > 0
            ? "/cont#de-refacut"
            : link.href;
        return (
          <Link
            key={link.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            {link.label}
            {link.href === "/cont" && redoCount > 0 && (
              <span
                title={`${redoCount} probleme de refăcut singur`}
                className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white"
              >
                {redoCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
