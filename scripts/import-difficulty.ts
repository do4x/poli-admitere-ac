import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { levelLabel } from "../src/lib/domain";
import { parseDifficultyFile } from "../src/lib/import/difficultySchema";
import {
  planDifficultyAgainstDb,
  runDifficultyImport,
} from "../src/lib/import/difficultyRun";

/**
 * Apply DIFICULTATE.md grading blocks to the DB.
 *   npm run import:dificultate -- <file.json>                 (dry-run)
 *   npm run import:dificultate -- <file.json> --apply
 *   npm run import:dificultate -- <file.json> --apply --allow-unmatched
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
      "Utilizare: npm run import:dificultate -- <fișier.json> [--apply] [--allow-unmatched]",
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

  const parsed = parseDifficultyFile(text);
  if (!parsed.ok) {
    console.error(`${name}: ${parsed.error}`);
    process.exitCode = 1;
    return;
  }

  const plan = await planDifficultyAgainstDb(prisma, parsed.file);

  console.log(`${name}: ${apply ? "APLICARE" : "simulare (dry-run)"}`);
  for (const a of plan.assignments) {
    const label = `${levelLabel(a.row.level)}${a.row.bandMargin ? " ⚠" : ""} ${a.row.archetype}`;
    if (a.action === "set") {
      const from = a.fromLevel === null ? "(negradat)" : levelLabel(a.fromLevel);
      console.log(`  ~ ${a.examKey} / ${a.number}: ${from} → ${label}  D_raw ${a.row.dRaw}`);
    } else if (a.action === "skip") {
      console.log(`  = ${a.examKey} / ${a.number}: neschimbat (${label})`);
    }
  }
  const unmatched = plan.assignments.filter((a) => a.action === "unmatched");
  if (unmatched.length > 0) {
    console.warn(`  ATENȚIE — ${unmatched.length} gradări fără corespondent:`);
    for (const a of unmatched) {
      console.warn(`    ? ${a.examKey} / problema ${a.number}`);
    }
  }
  console.log(
    `  Rezumat: ${plan.counts.set} de setat, ${plan.counts.skipped} sărite, ${plan.counts.unmatched} fără corespondent`,
  );

  if (unmatched.length > 0 && !allowUnmatched) {
    console.error(
      "  Oprire: există gradări fără corespondent. Corectează fișierul sau folosește --allow-unmatched.",
    );
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("  (simulare — nimic nu a fost scris; adaugă --apply pentru a aplica)");
    return;
  }

  const report = await runDifficultyImport(prisma, parsed.file);
  console.log(
    `  Aplicat: ${report.counts.set} gradate, ${report.counts.skipped} sărite, ${report.counts.unmatched} fără corespondent`,
  );
  if (report.counts.set > 0) {
    // Difficulty rides in the cached problem catalog (see app/probleme/query.ts).
    // The CLI cannot reach that cache, so the gradings surface only after the
    // hourly revalidate or the next deploy.
    console.log(
      "  Notă: catalogul e în cache (1h). Local, șterge .next/cache/fetch-cache; în producție, redeploy sau așteaptă revalidarea.",
    );
  }
}

main()
  .catch((error) => {
    console.error(`Import dificultate eșuat: ${message(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
