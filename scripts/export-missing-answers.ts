import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";

/**
 * Dump the statements of every problem that still has no `correctAnswer`,
 * with its exact exam key, so they can be solved externally and fed back
 * through `npm run import:answers`. Output: scratchpad JSON (not committed).
 */
async function main() {
  const outArg = process.argv[2];
  if (!outArg) throw new Error("usage: tsx export-missing-answers.ts <outfile>");

  const missing = await prisma.problem.findMany({
    where: { OR: [{ correctAnswer: null }, { correctAnswer: "" }] },
    include: { exam: true },
    orderBy: [
      { exam: { subject: "asc" } },
      { exam: { year: "asc" } },
      { number: "asc" },
    ],
  });

  const items = missing.map((p) => ({
    exam: {
      year: p.exam.year,
      kind: p.exam.kind,
      subject: p.exam.subject,
      session: p.exam.session,
    },
    number: p.number,
    latex: p.latex,
  }));

  await mkdir(path.dirname(outArg), { recursive: true });
  await writeFile(outArg, JSON.stringify(items, null, 2), "utf8");
  console.log(`Wrote ${items.length} problems to ${outArg}`);
}

main().finally(() => prisma.$disconnect());
