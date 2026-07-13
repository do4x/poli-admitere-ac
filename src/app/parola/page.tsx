import { requireUser } from "@/lib/auth";
import { ParolaForm } from "./ParolaForm";

export const dynamic = "force-dynamic";

/** Landing page for the password-recovery link (session already set). */
export default async function ParolaPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Parolă nouă
        </h1>
        <p className="mt-1 text-sm text-muted">
          Setează parola cu care vei intra de acum înainte.
        </p>
      </div>
      <ParolaForm />
    </div>
  );
}
