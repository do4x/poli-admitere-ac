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

const STARE_LABELS: Record<SolveState, string> = {
  nerezolvata: "nerezolvată",
  singur: "rezolvată singur",
  doar_ai: "doar cu AI",
};

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const cls = active
    ? "border-amber-600 bg-amber-50 text-amber-700"
    : "border-stone-300 text-stone-600 hover:bg-stone-100";
  return (
    <Link
      href={href}
      className={`rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}
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
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function FilterBar({ current, params, tags, years, counts }: FilterBarProps) {
  const link = (key: string, value: string) =>
    `/probleme${toggleParam(params, key, value)}`;

  // Which tags to show: those of the active subject, or all when no subject.
  const visibleTags = current.subject
    ? tags.filter((t) => t.subject === current.subject)
    : tags;

  return (
    <div className="space-y-2 rounded border border-stone-300 bg-white p-3">
      <Group label="Scop">
        <Chip href={link("toate", "1")} active={!current.toate}>
          Doar departajare
        </Chip>
        <Chip href={link("toate", "1")} active={!!current.toate}>
          Toate problemele
        </Chip>
      </Group>

      <Group label="Materie">
        <Chip href={link("subject", "MATE")} active={current.subject === "MATE"}>
          Matematică
        </Chip>
        <Chip href={link("subject", "INFO")} active={current.subject === "INFO"}>
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
        {(Object.keys(STARE_LABELS) as SolveState[]).map((stare) => (
          <Chip
            key={stare}
            href={link("stare", stare)}
            active={current.stare === stare}
          >
            {STARE_LABELS[stare]}
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
            {tag.name} ({counts.byTag[tag.name] ?? 0})
          </Chip>
        ))}
        <Chip href={link("neclasificat", "1")} active={!!current.neclasificat}>
          neclasificat ({counts.neclasificat})
        </Chip>
      </Group>
    </div>
  );
}
