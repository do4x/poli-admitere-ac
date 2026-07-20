import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import {
  attemptDuration,
  grilaCountsAsDone,
  isDone,
  solveState,
  type AttemptLike,
  type SolveState,
} from "../src/lib/domain";

/**
 * Per-user learning-analytics export, for feeding a personal tutor model.
 *   npm run export:stats -- deniscioara.es@gmail.com
 *
 * Pulls every AnswerAttempt / Solution / AiMark for one user, joins them to
 * their problem + exam + topic tags, and derives:
 *   - per-problem: solve state (via the app's own domain rules), attempt
 *     counts, wrong-choice distribution, reveal usage, first-correct try;
 *   - per-topic / per-subject / per-exam rollups: completion rate + failure
 *     rate, so the tutor can spot weak topics.
 *
 * Solve state / done are computed with src/lib/domain so the numbers here match
 * exactly what the dashboard counter shows. Read-only: writes nothing to the DB.
 */

const DEFAULT_EMAIL = "deniscioara.es@gmail.com";

/** attempt kinds → the shape solveState/grilaCountsAsDone expect. */
type Kind = "CHOICE" | "REVEAL";

interface ProblemStat {
  problemId: string;
  exam: { year: number; kind: string; subject: string; session: string | null };
  number: string;
  isDepartajare: boolean;
  topics: string[];
  state: SolveState;
  done: boolean;
  attempts: {
    total: number;
    choices: number; // CHOICE attempts (excludes reveals)
    correct: number; // correct choices
    wrong: number; // wrong choices
    reveals: number; // times the key was revealed
    firstCorrectTry: number | null; // 1-based; null if never correct pre-reveal
    grilaCountsAsDone: boolean; // correct within first 2 tries, pre-reveal
    wrongChoices: string[]; // distractors picked, in order (a..f)
    // Active seconds from first attempt to first untainted correct choice;
    // gaps > 15 min excluded (session breaks). null = never correct pre-reveal.
    durationSeconds: number | null;
  };
  solutions: { total: number; independent: number; aiAssisted: number };
  aiMark: { markedAt: string; dueAt: string; redeemedAt: string | null } | null;
  firstSeen: string | null; // earliest attempt timestamp
  lastSeen: string | null; // latest attempt timestamp
  spanSeconds: number | null; // last - first attempt (noisy engagement proxy)
}

interface Rollup {
  key: string;
  subject?: string;
  catalogProblems: number; // problems in this bucket in the whole catalog
  attemptedProblems: number; // problems the user actually touched
  doneProblems: number;
  completionOfCatalog: number; // done / catalog
  completionOfAttempted: number; // done / attempted
  choices: number;
  correct: number;
  wrong: number;
  reveals: number;
  failureRate: number; // wrong / choices
  revealRate: number; // reveals / (choices + reveals)
  // Mean of the problems' durationSeconds (null-durations excluded); null when
  // no problem in the bucket has a measurable duration.
  avgDurationSeconds: number | null;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

/** Reduce a problem's chronological attempts into per-problem attempt facts. */
function summariseAttempts(
  attempts: readonly {
    kind: Kind;
    choice: string | null;
    correct: boolean | null;
    createdAt: Date;
  }[],
): ProblemStat["attempts"] {
  let choices = 0;
  let correct = 0;
  let wrong = 0;
  let reveals = 0;
  let firstCorrectTry: number | null = null;
  let revealed = false;
  const wrongChoices: string[] = [];

  for (const a of attempts) {
    if (a.kind === "REVEAL") {
      reveals++;
      revealed = true;
      continue;
    }
    choices++;
    if (a.correct === true) {
      correct++;
      if (firstCorrectTry === null && !revealed) firstCorrectTry = choices;
    } else {
      wrong++;
      if (a.choice) wrongChoices.push(a.choice);
    }
  }

  const domainAttempts: AttemptLike[] = attempts.map((a) => ({
    kind: a.kind,
    correct: a.correct,
  }));

  const durationMs = attemptDuration(attempts);

  return {
    total: attempts.length,
    choices,
    correct,
    wrong,
    reveals,
    firstCorrectTry,
    grilaCountsAsDone: grilaCountsAsDone(domainAttempts),
    wrongChoices,
    durationSeconds: durationMs === null ? null : Math.round(durationMs / 1000),
  };
}

function buildRollups(
  stats: ProblemStat[],
  catalogCountByKey: Map<string, number>,
  keyOf: (s: ProblemStat) => string[],
  subjectOf?: (s: ProblemStat) => string,
): Rollup[] {
  const acc = new Map<
    string,
    {
      subject?: string;
      attempted: number;
      done: number;
      choices: number;
      correct: number;
      wrong: number;
      reveals: number;
      durations: number[];
    }
  >();

  for (const s of stats) {
    for (const key of keyOf(s)) {
      const bucket =
        acc.get(key) ??
        {
          subject: subjectOf?.(s),
          attempted: 0,
          done: 0,
          choices: 0,
          correct: 0,
          wrong: 0,
          reveals: 0,
          durations: [],
        };
      bucket.attempted++;
      if (s.done) bucket.done++;
      bucket.choices += s.attempts.choices;
      bucket.correct += s.attempts.correct;
      bucket.wrong += s.attempts.wrong;
      bucket.reveals += s.attempts.reveals;
      if (s.attempts.durationSeconds !== null)
        bucket.durations.push(s.attempts.durationSeconds);
      acc.set(key, bucket);
    }
  }

  return [...acc.entries()]
    .map(([key, b]) => ({
      key,
      subject: b.subject,
      catalogProblems: catalogCountByKey.get(key) ?? b.attempted,
      attemptedProblems: b.attempted,
      doneProblems: b.done,
      completionOfCatalog: ratio(b.done, catalogCountByKey.get(key) ?? b.attempted),
      completionOfAttempted: ratio(b.done, b.attempted),
      choices: b.choices,
      correct: b.correct,
      wrong: b.wrong,
      reveals: b.reveals,
      failureRate: ratio(b.wrong, b.choices),
      revealRate: ratio(b.reveals, b.choices + b.reveals),
      avgDurationSeconds:
        b.durations.length === 0
          ? null
          : Math.round(
              b.durations.reduce((sum, d) => sum + d, 0) / b.durations.length,
            ),
    }))
    .sort((a, b) => b.failureRate - a.failureRate);
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Niciun utilizator cu email ${email}`);
  }

  // Every problem the user has touched, in any way, with the user's own rows.
  const problems = await prisma.problem.findMany({
    where: {
      OR: [
        { attempts: { some: { userId: user.id } } },
        { solutions: { some: { userId: user.id } } },
        { aiMarks: { some: { userId: user.id } } },
      ],
    },
    include: {
      exam: true,
      tags: { select: { name: true }, orderBy: { name: "asc" } },
      attempts: {
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { kind: true, choice: true, correct: true, createdAt: true },
      },
      solutions: {
        where: { userId: user.id },
        select: { aiAssisted: true },
      },
      aiMarks: {
        where: { userId: user.id },
        select: { markedAt: true, dueAt: true, redeemedAt: true },
      },
    },
  });

  const now = new Date();

  const problemStats: ProblemStat[] = problems.map((p) => {
    const aiMark = p.aiMarks[0] ?? null;
    const domainAttempts: AttemptLike[] = p.attempts.map((a) => ({
      kind: a.kind,
      correct: a.correct,
    }));
    const state = solveState(p.solutions, domainAttempts, aiMark, now);
    const done = isDone(
      {
        isDepartajare: p.isDepartajare,
        solutions: p.solutions,
        attempts: domainAttempts,
        aiMark,
      },
      now,
    );

    const firstSeen = p.attempts[0]?.createdAt ?? null;
    const lastSeen = p.attempts[p.attempts.length - 1]?.createdAt ?? null;

    return {
      problemId: p.id,
      exam: {
        year: p.exam.year,
        kind: p.exam.kind,
        subject: p.exam.subject,
        session: p.exam.session,
      },
      number: p.number,
      isDepartajare: p.isDepartajare,
      topics: p.tags.map((t) => t.name),
      state,
      done,
      attempts: summariseAttempts(p.attempts),
      solutions: {
        total: p.solutions.length,
        independent: p.solutions.filter((s) => !s.aiAssisted).length,
        aiAssisted: p.solutions.filter((s) => s.aiAssisted).length,
      },
      aiMark: aiMark
        ? {
            markedAt: aiMark.markedAt.toISOString(),
            dueAt: aiMark.dueAt.toISOString(),
            redeemedAt: aiMark.redeemedAt?.toISOString() ?? null,
          }
        : null,
      firstSeen: firstSeen?.toISOString() ?? null,
      lastSeen: lastSeen?.toISOString() ?? null,
      spanSeconds:
        firstSeen && lastSeen
          ? Math.round((lastSeen.getTime() - firstSeen.getTime()) / 1000)
          : null,
    };
  });

  // Catalog denominators (whole DB, not just what the user touched) so
  // completion rate has a real "out of everything" reading per topic/subject.
  const [catalogByTag, catalogBySubject] = await Promise.all([
    prisma.tag.findMany({
      select: { name: true, _count: { select: { problems: true } } },
    }),
    prisma.problem
      .findMany({ select: { exam: { select: { subject: true } } } })
      .then((rows) => {
        const m = new Map<string, number>();
        for (const r of rows)
          m.set(r.exam.subject, (m.get(r.exam.subject) ?? 0) + 1);
        return m;
      }),
  ]);

  const catalogByTagMap = new Map(
    catalogByTag.map((t) => [t.name, t._count.problems]),
  );

  const byTopic = buildRollups(
    problemStats,
    catalogByTagMap,
    (s) => s.topics,
    (s) => s.exam.subject,
  );
  const bySubject = buildRollups(
    problemStats,
    catalogBySubject,
    (s) => [s.exam.subject],
  );
  const byExam = buildRollups(
    problemStats,
    new Map(),
    (s) => [
      `${s.exam.subject} ${s.exam.kind} ${s.exam.year}${s.exam.session ? ` (${s.exam.session})` : ""}`,
    ],
  );

  const stateCounts: Record<SolveState, number> = {
    nerezolvata: 0,
    grila: 0,
    doar_ai: 0,
    singur: 0,
  };
  let totalChoices = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalReveals = 0;
  for (const s of problemStats) {
    stateCounts[s.state]++;
    totalChoices += s.attempts.choices;
    totalCorrect += s.attempts.correct;
    totalWrong += s.attempts.wrong;
    totalReveals += s.attempts.reveals;
  }

  const output = {
    generatedAt: now.toISOString(),
    user: { id: user.id, email: user.email },
    overview: {
      problemsTouched: problemStats.length,
      byState: stateCounts,
      doneProblems: problemStats.filter((s) => s.done).length,
      totalChoices,
      totalCorrect,
      totalWrong,
      totalReveals,
      accuracy: ratio(totalCorrect, totalChoices),
      revealRate: ratio(totalReveals, totalChoices + totalReveals),
    },
    byTopic,
    bySubject,
    byExam,
    problems: problemStats,
  };

  const dir = path.resolve("export");
  await mkdir(dir, { recursive: true });
  const stamp = now.toISOString().slice(0, 10);
  const safeEmail = email.replace(/[^a-z0-9]+/gi, "_");
  const target = path.join(dir, `user-stats-${safeEmail}-${stamp}.json`);
  await writeFile(target, JSON.stringify(output, null, 2), "utf8");

  // Human summary to stdout.
  const o = output.overview;
  console.log(`\nStatistici pentru ${user.email}`);
  console.log(`  probleme atinse:   ${o.problemsTouched}`);
  console.log(
    `  stare:             singur=${stateCounts.singur} grila=${stateCounts.grila} doar_ai=${stateCounts.doar_ai} nerezolvate=${stateCounts.nerezolvata}`,
  );
  console.log(`  done:              ${o.doneProblems}`);
  console.log(
    `  răspunsuri grilă:  ${o.totalChoices} (corecte=${o.totalCorrect}, greșite=${o.totalWrong}, acuratețe=${(o.accuracy * 100).toFixed(1)}%)`,
  );
  console.log(`  revelări cheie:    ${o.totalReveals}`);
  console.log(`\n  Top teme după rată de eșec (min. 3 răspunsuri):`);
  for (const t of byTopic.filter((t) => t.choices >= 3).slice(0, 8)) {
    console.log(
      `    ${(t.failureRate * 100).toFixed(0).padStart(3)}% eșec  ${String(t.doneProblems)}/${t.attemptedProblems} done  ${t.key}`,
    );
  }
  console.log(`\nScris în ${target}\n`);
}

main()
  .catch((error) => {
    console.error(
      `Export eșuat: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
