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
  { href: "/import", label: "Import", requires: "admin" },
  { href: "/cont", label: "Cont", requires: "user" },
];

export function Nav({ user }: { user: NavUser | null }) {
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
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
