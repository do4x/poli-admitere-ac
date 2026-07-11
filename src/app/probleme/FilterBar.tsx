import Link from "next/link";
import type { SolveState, TagCounts } from "@/lib/domain";
import type { PageFilters } from "./searchFilters";
import { toggleParam } from "./searchFilters";

type RawParams = Record<string, string | string[] | undefined>;

interface TagInfo {
  name: string;
  subject: "MATE" | "INFO";
}

interface FilterBarProps {
  current: PageFilters;
  params: RawParams;
  tags: TagInfo[];
  years: number[];
  counts: TagCounts;
}

const STARE: { key: SolveState; label: string; active: string }[] = [
  { key: "nerezolvata", label: "nerezolvată", active: "bg-rose-600 text-white border-rose-600" },
  { key: "grila", label: "verificată pe grilă", active: "bg-teal-600 text-white border-teal-600" },
  { key: "singur", label: "rezolvată singur", active: "bg-green-600 text-white border-green-600" },
  { key: "doar_ai", label: "doar cu AI", active: "bg-orange-500 text-white border-orange-500" },
];

const BRAND_ACTIVE = "bg-brand text-white border-brand";

function Chip({
  href,
  active,
  activeClass = BRAND_ACTIVE,
  children,
}: {
  href: string;
  active: boolean;
  activeClass?: string;
  children: React.ReactNode;
}) {
  const cls = active
    ? activeClass
    : "border-line bg-card text-muted hover:border-ink/20 hover:text-ink";
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-soft transition-colors ${cls}`}
    >
      {children}
    </Link>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function FilterBar({ current, params, tags, years, counts }: FilterBarProps) {
  const link = (key: string, value: string) =>
    `/probleme${toggleParam(params, key, value)}`;

  const visibleTags = current.subject
    ? tags.filter((t) => t.subject === current.subject)
    : tags;

  return (
    <div className="card space-y-2.5 p-4">
      <Group label="Scop">
        <Chip href={link("toate", "1")} active={!current.toate}>
          Doar departajare
        </Chip>
        <Chip href={link("toate", "1")} active={!!current.toate}>
          Toate problemele
        </Chip>
      </Group>

      <Group label="Materie">
        <Chip
          href={link("subject", "MATE")}
          active={current.subject === "MATE"}
          activeClass="bg-blue-600 text-white border-blue-600"
        >
          Matematică
        </Chip>
        <Chip
          href={link("subject", "INFO")}
          active={current.subject === "INFO"}
          activeClass="bg-violet-600 text-white border-violet-600"
        >
          Informatică
        </Chip>
      </Group>

      {years.length > 0 && (
        <Group label="An">
          {years.map((year) => (
            <Chip
              key={year}
              href={link("an", String(year))}
              active={current.year === year}
            >
              {year}
            </Chip>
          ))}
        </Group>
      )}

      <Group label="Stare">
        {STARE.map((s) => (
          <Chip
            key={s.key}
            href={link("stare", s.key)}
            active={current.stare === s.key}
            activeClass={s.active}
          >
            {s.label}
          </Chip>
        ))}
      </Group>

      <Group label="Tip">
        {visibleTags.map((tag) => (
          <Chip
            key={`${tag.subject}-${tag.name}`}
            href={link("tag", tag.name)}
            active={current.tagName === tag.name}
          >
            {tag.name}
            <span className="ml-1 text-[10px] opacity-60">
              {counts.byTag[tag.name] ?? 0}
            </span>
          </Chip>
        ))}
        <Chip href={link("neclasificat", "1")} active={!!current.neclasificat}>
          neclasificat
          <span className="ml-1 text-[10px] opacity-60">{counts.neclasificat}</span>
        </Chip>
      </Group>
    </div>
  );
}
