import { createClient } from "@/lib/supabase/server";

/**
 * Solution files live in the private Supabase Storage bucket "solutions",
 * under {userId}/{problemId}/{timestamp}.{pdf|png|jpg}. Storage RLS restricts
 * every operation to the caller's own folder, so all functions here run with
 * the session user's client — no service-role key anywhere.
 */
export const SOLUTIONS_BUCKET = "solutions";
export const MAX_SOLUTION_BYTES = 10 * 1024 * 1024; // per-file cap, mirrored in the bucket config
export const QUOTA_MAX_FILES = 100;
export const QUOTA_MAX_BYTES = 500 * 1024 * 1024;

/** Accepted solution uploads: MIME → the extension used in the Storage path. */
export const SOLUTION_MIME_EXT = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;
export type SolutionMime = keyof typeof SOLUTION_MIME_EXT;

/**
 * Sniff the real type from magic bytes — never trust the filename or the
 * browser-supplied MIME. Returns null for anything that isn't PDF/PNG/JPEG.
 */
export function detectSolutionMime(bytes: Buffer): SolutionMime | null {
  if (bytes.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export async function uploadSolutionFile(
  userId: string,
  problemId: string,
  bytes: Buffer,
  submittedAt: Date,
  mime: SolutionMime,
): Promise<string> {
  const supabase = await createClient();
  const path = `${userId}/${problemId}/${submittedAt.getTime()}.${SOLUTION_MIME_EXT[mime]}`;
  const { error } = await supabase.storage
    .from(SOLUTIONS_BUCKET)
    .upload(path, bytes, { contentType: mime });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return path;
}

export async function removeSolutionFile(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(SOLUTIONS_BUCKET).remove([path]);
}

/** Short-lived signed URL — the only way a solution file ever reaches a browser. */
export async function signedSolutionUrl(
  path: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(SOLUTIONS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
