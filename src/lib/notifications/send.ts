import { Resend } from "resend";
import type { Digest } from "./digest";

export type DigestSender = (digest: Digest) => Promise<void>;

/**
 * Returns a Resend-backed sender for one recipient, or null when the env
 * vars are absent — the caller logs and skips. Never crash over email.
 */
export function createResendSender(to: string): DigestSender | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !to || !from) {
    return null;
  }
  const resend = new Resend(apiKey);
  return async (digest) => {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: digest.subject,
      text: digest.text,
    });
    // Throw so checkDueReviews aborts without stamping and retries next cycle.
    if (error) {
      throw new Error(`Resend: ${error.message}`);
    }
  };
}
