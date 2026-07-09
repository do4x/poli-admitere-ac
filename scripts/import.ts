import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { parseImportFile } from "../src/lib/import/schema";
import { runImport } from "../src/lib/import/run";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveTargets(args: string[]): Promise<string[]> {
  if (args.length > 0) {
    return args;
  }
  const dir = path.resolve("import");
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  return entries
    .filter((entry) => entry.toLowerCase().endsWith(".json"))
    .sort()
    .map((entry) => path.join(dir, entry));
}

async function main(): Promise<void> {
  const targets = await resolveTargets(process.argv.slice(2));
  if (targets.length === 0) {
    console.log("Nimic de importat — directorul import/ este gol.");
    return;
  }

  let failed = 0;
  for (const target of targets) {
    const name = path.basename(target);
    let text: string;
    try {
      text = await readFile(target, "utf8");
    } catch (error) {
      console.error(`${name}: nu pot citi fișierul — ${message(error)}`);
      failed += 1;
      continue;
    }

    const parsed = parseImportFile(text);
    if (!parsed.ok) {
      console.error(`${name}: ${parsed.error}`);
      failed += 1;
      continue;
    }

    try {
      const result = await runImport(prisma, parsed.file);
      const { created, updated, skipped } = result.counts;
      const exam = parsed.file.exam;
      const label = `${exam.year} ${exam.kind} ${exam.subject}${exam.session ? ` (${exam.session})` : ""}`;
      console.log(
        `${name}: ${label} — examen ${result.examCreated ? "creat" : "existent"}, ` +
          `${created} create, ${updated} actualizate, ${skipped} sărite`,
      );
    } catch (error) {
      console.error(`${name}: import eșuat — ${message(error)}`);
      failed += 1;
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`Import eșuat: ${message(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
