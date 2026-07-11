import Link from "next/link";
import { prisma } from "@/lib/db";
import { examProgress } from "@/lib/domain";

export const dynamic = "force-dynamic";

const YEARS = Array.from({ length: 12 }, (_, i) => 2026 - i);
const COLUMNS = [
  { kind: "ADMITERE", subject: "MATE", label: "Admitere Mate", dot: "bg-blue-500" },
  { kind: "ADMITERE", subject: "INFO", label: "Admitere Info", dot: "bg-violet-500" },
  { kind: "PREADMITERE", subject: "MATE", label: "Pre-admitere Mate", dot: "bg-blue-500" },
  { kind: "PREADMITERE", subject: "INFO", label: "Pre-admitere Info", dot: "bg-violet-500" },
] as const;

export default async function ExamsPage() {
  const exams = await prisma.exam.findMany({
    include: {
      problems: {
        select: {
          isDepartajare: true,
          solutions: { select: { aiAssisted: true } },
        },
      },
    },
  });

  const byCell = new Map<string, typeof exams>();
  for (const exam of exams) {
    const key = `${exam.year}|${exam.kind}|${exam.subject}`;
    const cell = byCell.get(key) ?? [];
    cell.push(exam);
    byCell.set(key, cell);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Examene
        </h1>
        <p className="mt-1 text-sm text-muted">
          Progresul arată problemele de departajare rezolvate singur / total pe
          examen.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-semibold text-muted">An</th>
              {COLUMNS.map((column) => (
                <th key={column.label} className="px-4 py-3 font-semibold text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                    {column.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {YEARS.map((year) => (
              <tr
                key={year}
                className="border-b border-line/70 last:border-0 hover:bg-surface/60"
              >
                <td className="px-4 py-2.5 font-semibold tabular-nums">{year}</td>
                {COLUMNS.map((column) => {
                  const cell =
                    byCell.get(`${year}|${column.kind}|${column.subject}`) ?? [];
                  return (
                    <td key={column.label} className="px-4 py-2.5 align-top">
                      {cell.length === 0 ? (
                        <span className="text-line">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {cell.map((exam) => {
                            const progress = examProgress(exam.problems);
                            const done =
                              progress.total > 0 &&
                              progress.done === progress.total;
                            return (
                              <li key={exam.id}>
                                <Link
                                  href={`/exams/${exam.id}`}
                                  className="inline-flex items-baseline gap-2 hover:underline"
                                >
                                  <span
                                    className={`font-semibold tabular-nums ${
                                      done ? "text-green-600" : "text-ink"
                                    }`}
                                  >
                                    {progress.done}/{progress.total}
                                  </span>
                                  {exam.session && (
                                    <span className="text-xs text-faint">
                                      {exam.session}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
