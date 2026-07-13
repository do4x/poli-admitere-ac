import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "./AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const params = await searchParams;
  const linkError = params.error === "link";

  return (
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Bine ai venit
        </h1>
        <p className="mt-1 text-sm text-muted">
          Contul îți păstrează progresul, soluțiile și verificările la grilă.
          Problemele se pot răsfoi liber.
        </p>
      </div>
      {linkError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Linkul este invalid sau expirat. Intră în cont sau cere altul.
        </p>
      )}
      <AuthForm googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "1"} />
    </div>
  );
}
