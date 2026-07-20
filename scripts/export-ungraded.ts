import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";

/**
 * Dump every problem that has no difficulty grading yet, in batches, so they
 * can be scored offline against DIFICULTATE.md and fed back through
 * `npm run import:dificultate`.
 *   npm run export:negradate [-- --batch 20]
 *
 * Writes import/dificultate/_negradate-{n}.json — the exam key and number of
 * each batch member plus its statement and official key, which the grader
 * needs to analyse the distractors (§9 step 5).
 */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sizeArg = args.indexOf("--batch");
  const batchSize = sizeArg >= 0 ? Number(args[sizeArg + 1]) : 20;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    console.error("--batch trebuie să fie un întreg pozitiv");
    process.exitCode = 1;
    return;
  }

  const problems = await prisma.problem.findMany({
    where: { difficulty: null },
    include: { exam: true, tags: { select: { name: true } } },
    orderBy: [
      { exam: { subject: "asc" } },
      { exam: { year: "asc" } },
      { number: "asc" },
    ],
  });

  const dir = path.resolve("import", "dificultate");
  await mkdir(dir, { recursive: true });

  for (let i = 0; i < problems.length; i += batchSize) {
    const batch = problems.slice(i, i + batchSize).map((p) => ({
      exam: {
        year: p.exam.year,
        kind: p.exam.kind,
        subject: p.exam.subject,
        session: p.exam.session,
      },
      number: p.number,
      isDepartajare: p.isDepartajare,
      tags: p.tags.map((t) => t.name),
      correctAnswer: p.correctAnswer,
      latex: p.latex,
    }));
    const target = path.join(
      dir,
      `_negradate-${String(i / batchSize + 1).padStart(2, "0")}.json`,
    );
    await writeFile(target, JSON.stringify(batch, null, 2), "utf8");
    console.log(`  ${path.basename(target)}: ${batch.length} probleme`);
  }

  const graded = await prisma.difficulty.count();
  console.log(
    `Negradate: ${problems.length} (gradate: ${graded}) → ${path.relative(process.cwd(), dir)}`,
  );
}

main()
  .catch((error) => {
    console.error(
      `Export negradate eșuat: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
