import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { parseAnswersFile } from "../src/lib/import/answersSchema";
import { planAnswersAgainstDb, runAnswersImport } from "../src/lib/import/answersRun";

/**
 * Apply official grila keys to the DB.
 *   npm run import:answers -- <file.json>                 (dry-run)
 *   npm run import:answers -- <file.json> --apply
 *   npm run import:answers -- <file.json> --apply --allow-unmatched
 */

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const allowUnmatched = args.includes("--allow-unmatched");
  const files = args.filter((a) => !a.startsWith("--"));

  if (files.length !== 1) {
    console.error(
      "Utilizare: npm run import:answers -- <fișier.json> [--apply] [--allow-unmatched]",
    );
    process.exitCode = 1;
    return;
  }

  const target = files[0];
  const name = path.basename(target);

  let text: string;
  try {
    text = await readFile(target, "utf8");
  } catch (error) {
    console.error(`${name}: nu pot citi fișierul — ${message(error)}`);
    process.exitCode = 1;
    return;
  }

  const parsed = parseAnswersFile(text);
  if (!parsed.ok) {
    console.error(`${name}: ${parsed.error}`);
    process.exitCode = 1;
    return;
  }

  const plan = await planAnswersAgainstDb(prisma, parsed.file);

  console.log(`${name}: ${apply ? "APLICARE" : "simulare (dry-run)"}`);
  for (const a of plan.assignments) {
    if (a.action === "set") {
      console.log(`  ~ ${a.examKey} / ${a.number}: ${a.from ?? "(fără)"} → ${a.to}`);
    } else if (a.action === "skip") {
      console.log(`  = ${a.examKey} / ${a.number}: neschimbat (${a.to})`);
    }
  }
  const unmatched = plan.assignments.filter((a) => a.action === "unmatched");
  if (unmatched.length > 0) {
    console.warn(`  ATENȚIE — ${unmatched.length} răspunsuri fără corespondent:`);
    for (const a of unmatched) {
      console.warn(`    ? ${a.examKey} / problema ${a.number}`);
    }
  }
  console.log(
    `  Rezumat: ${plan.counts.set} de setat, ${plan.counts.skipped} sărite, ${plan.counts.unmatched} fără corespondent`,
  );

  if (unmatched.length > 0 && !allowUnmatched) {
    console.error(
      "  Oprire: există răspunsuri fără corespondent. Corectează fișierul sau folosește --allow-unmatched.",
    );
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("  (simulare — nimic nu a fost scris; adaugă --apply pentru a aplica)");
    return;
  }

  const report = await runAnswersImport(prisma, parsed.file);
  console.log(
    `  Aplicat: ${report.counts.set} setate, ${report.counts.skipped} sărite, ${report.counts.unmatched} fără corespondent`,
  );
}

main()
  .catch((error) => {
    console.error(`Import răspunsuri eșuat: ${message(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
