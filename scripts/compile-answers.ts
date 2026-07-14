import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Zip solver outputs (scratchpad/answers/batch-*.json) back to exact exam keys
 * from missing-problems.json (matched by global `index`), and emit an
 * answers-import file in the shape `npm run import:answers` expects.
 *
 *   tsx compile-answers.ts <missing-problems.json> <answers-dir> <out.json> [minConfidence]
 *
 * minConfidence: "high" | "medium" (default) | "low". Answers below the
 * threshold, and null answers, are excluded from the import file and listed
 * in the printed report.
 */
type Conf = "high" | "medium" | "low";
const RANK: Record<Conf, number> = { low: 0, medium: 1, high: 2 };

interface Missing {
  index?: number;
  exam: { year: number; kind: string; subject: string; session: string | null };
  number: string;
}
interface Answer {
  index: number;
  number: string;
  answer: string | null;
  confidence: Conf;
  reason?: string;
}

async function main() {
  const [missingFile, answersDir, outFile, minArg] = process.argv.slice(2);
  const min = (minArg as Conf) ?? "medium";

  const missing = JSON.parse(await readFile(missingFile, "utf8")) as Missing[];
  const byIndex = new Map<number, Missing>();
  missing.forEach((m, i) => byIndex.set(m.index ?? i, m));

  const files = (await readdir(answersDir)).filter(
    (f) => f.startsWith("batch-") && f.endsWith(".json"),
  );
  const answers: Answer[] = [];
  for (const f of files) {
    const arr = JSON.parse(
      await readFile(path.join(answersDir, f), "utf8"),
    ) as Answer[];
    answers.push(...arr);
  }
  answers.sort((a, b) => a.index - b.index);

  const assignments: Array<{ exam: Missing["exam"]; number: string; answer: string }> = [];
  const dropped: Answer[] = [];
  const conf: Record<Conf, number> = { high: 0, medium: 0, low: 0 };
  const seen = new Set<number>();

  for (const a of answers) {
    seen.add(a.index);
    conf[a.confidence] = (conf[a.confidence] ?? 0) + 1;
    const m = byIndex.get(a.index);
    if (!m) {
      console.warn(`! answer for unknown index ${a.index}`);
      continue;
    }
    const ok =
      a.answer != null &&
      /^[a-f]$/.test(a.answer) &&
      RANK[a.confidence] >= RANK[min];
    if (ok) {
      assignments.push({ exam: m.exam, number: m.number, answer: a.answer! });
    } else {
      dropped.push(a);
    }
  }

  const missingIdx = [...byIndex.keys()].filter((i) => !seen.has(i));

  await writeFile(outFile, JSON.stringify({ assignments }, null, 2), "utf8");

  console.log(`Answers collected: ${answers.length} / ${missing.length}`);
  console.log(`Confidence: high=${conf.high} medium=${conf.medium} low=${conf.low}`);
  console.log(`Import file (>= ${min}): ${assignments.length} assignments -> ${outFile}`);
  if (missingIdx.length) {
    console.log(`MISSING solver output for indices: ${missingIdx.join(", ")}`);
  }
  if (dropped.length) {
    console.log(`\nHeld back (below ${min} or null) — review manually:`);
    for (const a of dropped) {
      const m = byIndex.get(a.index);
      const label = m
        ? `${m.exam.subject} ${m.exam.year} ${m.exam.session ?? ""} #${m.number}`
        : `idx ${a.index}`;
      console.log(`  [${a.confidence}] ${label}: answer=${a.answer ?? "null"} — ${a.reason ?? ""}`);
    }
  }
}

main();
