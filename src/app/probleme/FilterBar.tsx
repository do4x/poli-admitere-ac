import Link from "next/link";
import {
  DEFAULT_SORT,
  DEPARTAJARE_LEVEL,
  levelLabel,
  starSlots,
  type SolveState,
  type SortKey,
  type TagCounts,
} from "@/lib/domain";
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
  /** Difficulty grading is admin-only for now. */
  showDifficulty?: boolean;
  /** How many problems in the current scope carry a grading at all. */
  gradedCount?: number;
  /** Active order; undefined = the default (`recente`). */
  sort?: SortKey;
}

/** Sort options, in the order they are offered. The two difficulty ones are
 *  hidden from non-admins, like the grading itself. */
const SORTARI: { key: SortKey; label: string; difficulty?: boolean }[] = [
  { key: "relevanta", label: "cele mai rezolvate" },
  { key: "greu", label: "dificultate ↓", difficulty: true },
  { key: "usor", label: "dificultate ↑", difficulty: true },
  { key: "recente", label: "recente → vechi" },
  { key: "vechi", label: "vechi → recente" },
];

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
      {/* Wide enough for the longest label ("Dificultate") so every row's chips
          start on the same x — a fixed w-16 let that label run into them. */}
      <span className="w-24 shrink-0 pr-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * "Dificultate minimă": five stars, each split into two halves, so a click
 * picks any level on the half-star scale of DIFICULTATE.md. Clicking the
 * level that is already active clears the filter (same toggle semantics as
 * every other chip), and so does "orice".
 */
function MinLevelPicker({
  params,
  min,
  gradedCount,
}: {
  params: RawParams;
  min: number | undefined;
  gradedCount: number | undefined;
}) {
  const link = (value: number) =>
    `/probleme${toggleParam(params, "dificultate", String(value))}`;
  const slots = starSlots(min ?? 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center text-lg leading-none text-amber-500">
        {slots.map((slot, i) => {
          const star = i + 1;
          return (
            <span key={star} className="relative inline-block">
              {/* A half star is drawn as a DIMMED star with its left half
                  overpainted at full opacity. The reverse (full star + a
                  translucent overlay on the right) cannot work: a transparent
                  layer never erases what is under it, so 2½ read as 3. */}
              <span aria-hidden className={slot === "full" ? "" : "opacity-20"}>
                ★
              </span>
              {slot === "half" && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/2 overflow-hidden"
                >
                  ★
                </span>
              )}
              {/* Two invisible hit targets per star: left half = X½, right half = X. */}
              <Link
                href={link(star - 0.5)}
                aria-label={`Dificultate minimă ${levelLabel(star - 0.5)}`}
                title={`≥ ${levelLabel(star - 0.5)}`}
                className="absolute inset-y-0 left-0 w-1/2 rounded-l transition-colors hover:bg-amber-500/15"
              />
              <Link
                href={link(star)}
                aria-label={`Dificultate minimă ${levelLabel(star)}`}
                title={`≥ ${levelLabel(star)}`}
                className="absolute inset-y-0 right-0 w-1/2 rounded-r transition-colors hover:bg-amber-500/15"
              />
            </span>
          );
        })}
      </span>

      <span className="text-xs font-medium text-muted tabular-nums">
        {min === undefined ? "orice dificultate" : `≥ ${levelLabel(min)}`}
      </span>

      {min !== undefined && (
        <Chip href={link(min)} active={false}>
          orice
        </Chip>
      )}

      <Chip
        href={link(DEPARTAJARE_LEVEL)}
        active={min === DEPARTAJARE_LEVEL}
        activeClass="bg-amber-500 text-white border-amber-500"
      >
        prag departajare ({levelLabel(DEPARTAJARE_LEVEL)})
      </Chip>

      {gradedCount !== undefined && (
        <span className="text-[11px] text-faint tabular-nums">
          {gradedCount} gradate
        </span>
      )}
    </div>
  );
}

export function FilterBar({
  current,
  params,
  tags,
  years,
  counts,
  showDifficulty = false,
  gradedCount,
  sort,
}: FilterBarProps) {
  const link = (key: string, value: string) =>
    `/probleme${toggleParam(params, key, value)}`;
  const activeSort = sort ?? DEFAULT_SORT;

  const visibleTags = current.subject
    ? tags.filter((t) => t.subject === current.subject)
    : tags;

  return (
    <div className="card space-y-2.5 p-4">
      {/* Ordering, not filtering — kept above the filters and ruled off, so
          "why is this problem first?" is answered before you scan the list. */}
      <div className="border-b border-line pb-2.5">
        <Group label="Sortare">
          {SORTARI.filter((s) => showDifficulty || !s.difficulty).map((s) => (
            <Chip
              key={s.key}
              href={link("sortare", s.key)}
              active={activeSort === s.key}
            >
              {s.label}
            </Chip>
          ))}
        </Group>
      </div>

      <Group label="Scop">
        <Chip href={link("toate", "1")} active={!current.toate}>
          Doar departajare
        </Chip>
        <Chip href={link("toate", "1")} active={!!current.toate}>
          Toate problemele
        </Chip>
      </Group>

      {showDifficulty && (
        <Group label="Dificultate">
          <MinLevelPicker
            params={params}
            min={current.minLevel}
            gradedCount={gradedCount}
          />
        </Group>
      )}

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
