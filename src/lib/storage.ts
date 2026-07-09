import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SOLUTIONS_DIR = path.join(process.cwd(), "data", "solutions");

/** Resolve a DB-stored relative pdfPath, refusing anything that escapes the dir. */
export function solutionAbsolutePath(relativePdfPath: string): string {
  const root = path.resolve(SOLUTIONS_DIR);
  const abs = path.resolve(root, relativePdfPath);
  if (!abs.startsWith(root + path.sep)) {
    throw new Error(`pdfPath escapes solutions dir: ${relativePdfPath}`);
  }
  return abs;
}

/**
 * Store PDF bytes as data/solutions/{problemId}/{timestamp}.pdf and return
 * the relative path (posix separators) for the DB.
 */
export async function savePdf(
  problemId: string,
  bytes: Buffer,
  submittedAt: Date,
): Promise<string> {
  let timestamp = submittedAt.getTime();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const relative = `${problemId}/${timestamp}.pdf`;
    const absolute = solutionAbsolutePath(relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    try {
      await writeFile(absolute, bytes, { flag: "wx" });
      return relative;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      timestamp += 1;
    }
  }
  throw new Error("Could not allocate a unique PDF filename");
}
