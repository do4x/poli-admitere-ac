import type { SolveState } from "@/lib/domain";

/**
 * URL param names for /probleme. `tag` carries the tag NAME (URL-encoded).
 * Absence of `toate` means the default scope: departajare problems only.
 */
export interface PageFilters {
  tagName?: string;
  subject?: "MATE" | "INFO";
  year?: number;
  stare?: SolveState;
  neclasificat?: boolean;
  /** true ⇒ include non-departajare problems too. */
  toate?: boolean;
}

const STARI: readonly SolveState[] = ["nerezolvata", "grila", "singur", "doar_ai"];

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parse raw searchParams into typed filters. Invalid values are dropped,
 * never errored — a junk URL simply yields no filter for that dimension.
 */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): PageFilters {
  const filters: PageFilters = {};

  const tag = first(searchParams.tag);
  if (tag && tag.trim()) filters.tagName = tag;

  const subject = first(searchParams.subject);
  if (subject === "MATE" || subject === "INFO") filters.subject = subject;

  const an = first(searchParams.an);
  if (an !== undefined) {
    const year = Number(an);
    if (Number.isInteger(year) && year >= 2015 && year <= 2026) {
      filters.year = year;
    }
  }

  const stare = first(searchParams.stare);
  if (stare && (STARI as readonly string[]).includes(stare)) {
    filters.stare = stare as SolveState;
  }

  if (first(searchParams.neclasificat) === "1") filters.neclasificat = true;
  if (first(searchParams.toate) === "1") filters.toate = true;

  return filters;
}

/** Problems per /probleme page. */
export const PAGE_SIZE = 25;

/**
 * Parse the `pagina` search param: a 1-based page number, defaulting to 1
 * for anything absent/invalid (never throws on a junk URL).
 */
export function parsePage(
  searchParams: Record<string, string | string[] | undefined>,
): number {
  const raw = first(searchParams.pagina);
  const n = raw !== undefined ? Number(raw) : 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Href for a given page number, preserving every other active search param.
 * Page 1 omits `pagina` entirely so the "default" URL stays clean.
 */
export function pageHref(
  current: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === "pagina") continue;
    const single = first(v);
    if (single !== undefined && single !== "") params.set(k, single);
  }
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/probleme?${query}` : "/probleme";
}

/**
 * Query string for a chip link: toggles `key`=`value` on top of the current
 * raw params — sets it if absent/different, clears it if already active —
 * while preserving every other active param. Returns "" when no params remain.
 */
export function toggleParam(
  current: Record<string, string | string[] | undefined>,
  key: string,
  value: string,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const single = first(v);
    if (single !== undefined && single !== "") params.set(k, single);
  }

  if (params.get(key) === value) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  // Changing a filter invalidates the old page position — back to page 1.
  params.delete("pagina");

  const query = params.toString();
  return query ? `?${query}` : "";
}
