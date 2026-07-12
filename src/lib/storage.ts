import { createClient } from "@/lib/supabase/server";

/**
 * Solution PDFs live in the private Supabase Storage bucket "solutions",
 * under {userId}/{problemId}/{timestamp}.pdf. Storage RLS restricts every
 * operation to the caller's own folder, so all functions here run with the
 * session user's client — no service-role key anywhere.
 */
export const SOLUTIONS_BUCKET = "solutions";
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // mirrored in the bucket config
export const QUOTA_MAX_FILES = 100;
export const QUOTA_MAX_BYTES = 500 * 1024 * 1024;

export async function uploadPdf(
  userId: string,
  problemId: string,
  bytes: Buffer,
  submittedAt: Date,
): Promise<string> {
  const supabase = await createClient();
  const path = `${userId}/${problemId}/${submittedAt.getTime()}.pdf`;
  const { error } = await supabase.storage
    .from(SOLUTIONS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf" });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return path;
}

export async function removePdf(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(SOLUTIONS_BUCKET).remove([path]);
}

/** Short-lived signed URL — the only way a PDF ever reaches a browser. */
export async function signedPdfUrl(
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
