import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";

/**
 * Dump every problem statement (with its exam key and current tags) to
 * import/problems-export.json, for external classification by Claude.
 *   npm run export:problems
 */

interface ExportedProblem {
  exam: {
    year: number;
    kind: string;
    subject: string;
    session: string | null;
  };
  number: string;
  isDepartajare: boolean;
  currentTypes: string[];
  latex: string;
}

async function main(): Promise<void> {
  const problems = await prisma.problem.findMany({
    include: {
      exam: true,
      tags: { select: { name: true }, orderBy: { name: "asc" } },
    },
    orderBy: [{ exam: { year: "asc" } }, { number: "asc" }],
  });

  const exported: ExportedProblem[] = problems.map((p) => ({
    exam: {
      year: p.exam.year,
      kind: p.exam.kind,
      subject: p.exam.subject,
      session: p.exam.session,
    },
    number: p.number,
    isDepartajare: p.isDepartajare,
    currentTypes: p.tags.map((t) => t.name),
    latex: p.latex,
  }));

  const dir = path.resolve("import");
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "problems-export.json");
  // Plain UTF-8, no BOM (Node's writeFile writes none).
  await writeFile(target, JSON.stringify(exported, null, 2), "utf8");

  console.log(`Exportate ${exported.length} probleme în ${target}`);
}

main()
  .catch((error) => {
    console.error(
      `Export eșuat: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
