import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Split missing-problems.json into N batch files, each item carrying a global
// `index` so answers can be zipped back to exact exam keys without the solver
// ever touching the session strings.
async function main() {
  const [inFile, outDir, batchSizeArg] = process.argv.slice(2);
  const batchSize = Number(batchSizeArg ?? "12");
  const items = JSON.parse(await readFile(inFile, "utf8")) as unknown[];
  await mkdir(outDir, { recursive: true });

  const indexed = items.map((it, index) => ({ index, ...(it as object) }));
  let batchNo = 0;
  for (let i = 0; i < indexed.length; i += batchSize) {
    batchNo += 1;
    const slice = indexed.slice(i, i + batchSize);
    const file = path.join(outDir, `batch-${batchNo}.json`);
    await writeFile(file, JSON.stringify(slice, null, 2), "utf8");
    console.log(`batch-${batchNo}.json: ${slice.length} problems (idx ${slice[0] && (slice[0] as { index: number }).index}..${(slice[slice.length - 1] as { index: number }).index})`);
  }
  console.log(`Total ${indexed.length} problems in ${batchNo} batches`);
}

main();
