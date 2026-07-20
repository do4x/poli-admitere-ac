import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import {
  withHintTaint,
  type AiMarkLike,
  type AttemptLike,
  type TimedAttemptLike,
} from "@/lib/domain";

/**
 * Cache tag for the shared problem catalog. Every admin mutation that changes
 * catalog data (import, tag edits, isDepartajare toggles) must call
 * `revalidateTag(CATALOG_TAG)` so the next render refetches from Postgres.
 */
export const CATALOG_TAG = "problem-catalog";

/**
 * The problem catalog: statements, exams and tags — identical for every
 * visitor, so it lives in the Data Cache instead of being pulled out of
 * Supabase on each render (~94KB of DB egress per request before this; the
 * free-tier egress quota blew at ~45 users). Per-user solve state is fetched
 * separately in `fetchUserState` — a few KB of the user's own rows only.
 *
 * No Date fields in the select: `unstable_cache` serializes through JSON, so
 * a Date would silently come back as a string.
 */
export const fetchCatalog = unstable_cache(
  () =>
    prisma.problem.findMany({
      // Single SQL query (LATERAL joins) instead of Prisma's default one
      // round-trip per relation — the pooled connection (Supabase pgbouncer,
      // transaction mode) pays a fixed ~70-140ms per statement.
      relationLoadStrategy: "join",
      select: {
        id: true,
        number: true,
        isDepartajare: true,
        latex: true, // `correctAnswer` stays out — the key never leaves the server actions
        exam: {
          select: {
            id: true,
            year: true,
            kind: true,
            subject: true,
            session: true,
          },
        },
        tags: { select: { name: true } },
        // Difficulty is a property of the problem, not of the user, so it
        // rides in the shared catalog. Only the fields the list and the
        // filter need — no Date columns (JSON-serialized cache).
        difficulty: {
          select: {
            level: true,
            dRaw: true,
            bandMargin: true,
            archetype: true,
            targetMinutes: true,
          },
        },
      },
    }),
  ["problem-catalog"],
  // Belt and braces: tag invalidation covers in-app mutations; the hourly
  // revalidate covers the CLI importer, which can't reach the deployed cache.
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

export type CatalogProblem = Awaited<ReturnType<typeof fetchCatalog>>[number];

/**
 * How many DISTINCT users have solved each problem — the "relevanță" sort.
 * Solved = uploaded a solution or checked a correct grila answer, which is
 * deliberately looser than the counter's `isDone`: this measures how much a
 * problem is worked on, not whether it is finished.
 *
 * Global (identical for everyone) and cheap — one row per problem — but it
 * moves as people practise, so it gets its own short-lived cache entry rather
 * than riding on the catalog's hourly one.
 */
export const fetchSolveCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const [solutionRows, attemptRows] = await Promise.all([
      prisma.solution.findMany({
        select: { problemId: true, userId: true },
        distinct: ["problemId", "userId"],
      }),
      prisma.answerAttempt.findMany({
        where: { correct: true },
        select: { problemId: true, userId: true },
        distinct: ["problemId", "userId"],
      }),
    ]);

    // A user who both uploaded and answered correctly must count once.
    const solvers = new Map<string, Set<string>>();
    for (const row of [...solutionRows, ...attemptRows]) {
      const set = solvers.get(row.problemId);
      if (set) set.add(row.userId);
      else solvers.set(row.problemId, new Set([row.userId]));
    }

    const counts: Record<string, number> = {};
    for (const [problemId, users] of solvers) counts[problemId] = users.size;
    return counts;
  },
  ["problem-solve-counts"],
  { revalidate: 300 },
);

export interface UserSolution {
  aiAssisted: boolean;
}

export interface UserAiMark extends AiMarkLike {
  dueAt: Date;
  redeemedAt: Date | null;
}

export interface UserState {
  solutions: Map<string, UserSolution[]>;
  attempts: Map<string, AttemptLike[]>;
  aiMarks: Map<string, UserAiMark>;
}

/** The current user's solve-state rows, grouped by problem id. Anonymous
 *  visitors skip the round trip entirely. */
async function fetchUserState(userId: string | undefined): Promise<UserState> {
  const solutions = new Map<string, UserSolution[]>();
  const attempts = new Map<string, AttemptLike[]>();
  const aiMarks = new Map<string, UserAiMark>();
  if (!userId) return { solutions, attempts, aiMarks };

  const [solutionRows, attemptRows, markRows, hintRows] = await Promise.all([
    prisma.solution.findMany({
      where: { userId },
      select: { problemId: true, aiAssisted: true },
    }),
    prisma.answerAttempt.findMany({
      where: { userId },
      // createdAt travels so opened hints can be interleaved by time.
      select: { problemId: true, kind: true, correct: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.aiMark.findMany({
      where: { userId },
      select: { problemId: true, dueAt: true, redeemedAt: true },
    }),
    prisma.hintReveal.findMany({
      where: { userId },
      select: { problemId: true, revealedAt: true },
    }),
  ]);

  for (const { problemId, ...solution } of solutionRows) {
    groupInto(solutions, problemId, solution);
  }

  // Hints are folded into the attempt stream as REVEALs, so every downstream
  // rule (state, counter, 2-try limit) treats them as the help they are.
  const hintsByProblem = new Map<string, Date[]>();
  for (const { problemId, revealedAt } of hintRows) {
    groupInto(hintsByProblem, problemId, revealedAt);
  }
  const timedByProblem = new Map<string, TimedAttemptLike[]>();
  for (const { problemId, ...attempt } of attemptRows) {
    groupInto(timedByProblem, problemId, attempt);
  }
  for (const problemId of new Set([
    ...timedByProblem.keys(),
    ...hintsByProblem.keys(),
  ])) {
    attempts.set(
      problemId,
      withHintTaint(
        timedByProblem.get(problemId) ?? [],
        hintsByProblem.get(problemId) ?? [],
      ),
    );
  }
  for (const { problemId, ...mark } of markRows) {
    aiMarks.set(problemId, mark);
  }
  return { solutions, attempts, aiMarks };
}

function groupInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const group = map.get(key);
  if (group) {
    group.push(value);
  } else {
    map.set(key, [value]);
  }
}

// Named to avoid colliding with the domain's `FilterableProblem` shape.
export type ProblemWithUserState = CatalogProblem & {
  solutions: UserSolution[];
  attempts: AttemptLike[];
  aiMark: UserAiMark | null;
};

/**
 * All problems with their exam and the current user's solve-state relations,
 * in the exact shape the /probleme list, the dashboard and the "next problem"
 * resolver all consume. Kept in one place so their ordering/filtering can
 * never drift. The shared catalog comes from the Data Cache; only the user's
 * own solutions/attempts hit Postgres.
 */
export async function fetchFilterableProblems(
  userId: string | undefined,
): Promise<ProblemWithUserState[]> {
  const [catalog, user] = await Promise.all([
    fetchCatalog(),
    fetchUserState(userId),
  ]);
  return catalog.map((problem) => ({
    ...problem,
    solutions: user.solutions.get(problem.id) ?? [],
    attempts: user.attempts.get(problem.id) ?? [],
    aiMark: user.aiMarks.get(problem.id) ?? null,
  }));
}
