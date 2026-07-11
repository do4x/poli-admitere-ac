import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { parseTagsFile } from "../src/lib/import/tagsSchema";
import { planTagsAgainstDb, runTagsImport } from "../src/lib/import/tagsRun";

/**
 * Apply Claude's bulk classification to the DB.
 *   npm run import:tags -- <file.json>                 (dry-run, writes nothing)
 *   npm run import:tags -- <file.json> --apply         (writes)
 *   npm run import:tags -- <file.json> --apply --allow-unmatched
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
      "Utilizare: npm run import:tags -- <fișier.json> [--apply] [--allow-unmatched]",
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

  const parsed = parseTagsFile(text);
  if (!parsed.ok) {
    console.error(`${name}: ${parsed.error}`);
    process.exitCode = 1;
    return;
  }

  const plan = await planTagsAgainstDb(prisma, parsed.file);

  console.log(`${name}: ${apply ? "APLICARE" : "simulare (dry-run)"}`);
  if (plan.newTagsToCreate.length > 0) {
    console.log(`  Tipuri noi de creat (${plan.newTagsToCreate.length}):`);
    for (const t of plan.newTagsToCreate) {
      console.log(`    + [${t.subject}] ${t.name}`);
    }
  }
  for (const a of plan.assignments) {
    if (a.action === "set") {
      const fromStr = a.from.length ? a.from.join(", ") : "(niciun tip)";
      console.log(`  ~ ${a.number}: ${fromStr} → ${a.to.join(", ")}`);
    } else if (a.action === "skip") {
      console.log(`  = ${a.number}: neschimbat (${a.to.join(", ")})`);
    }
  }
  const unmatched = plan.assignments.filter((a) => a.action === "unmatched");
  if (unmatched.length > 0) {
    console.warn(`  ATENȚIE — ${unmatched.length} atribuiri fără corespondent:`);
    for (const a of unmatched) {
      console.warn(`    ? ${a.examKey} / problema ${a.number}`);
    }
  }
  console.log(
    `  Rezumat: ${plan.counts.set} de setat, ${plan.counts.skipped} sărite, ${plan.counts.unmatched} fără corespondent`,
  );

  if (unmatched.length > 0 && !allowUnmatched) {
    console.error(
      "  Oprire: există atribuiri fără corespondent. Corectează fișierul sau folosește --allow-unmatched.",
    );
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("  (simulare — nimic nu a fost scris; adaugă --apply pentru a aplica)");
    return;
  }

  const report = await runTagsImport(prisma, parsed.file);
  console.log(
    `  Aplicat: ${report.tagged} etichetate, ${report.skipped} sărite, ` +
      `${report.newTags.length} tipuri create, ${report.unmatched.length} fără corespondent`,
  );
}

main()
  .catch((error) => {
    console.error(`Import etichete eșuat: ${message(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
