import Link from "next/link";
import { prisma } from "@/lib/db";
import { examProgress } from "@/lib/domain";

export const dynamic = "force-dynamic";

const YEARS = Array.from({ length: 12 }, (_, i) => 2026 - i);
const COLUMNS = [
  { kind: "ADMITERE", subject: "MATE", label: "Admitere Mate" },
  { kind: "ADMITERE", subject: "INFO", label: "Admitere Info" },
  { kind: "PREADMITERE", subject: "MATE", label: "Pre-admitere Mate" },
  { kind: "PREADMITERE", subject: "INFO", label: "Pre-admitere Info" },
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
      <h1 className="text-2xl font-bold">Examene</h1>
      <div className="overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 bg-stone-50 text-left">
              <th className="px-3 py-2 font-semibold">An</th>
              {COLUMNS.map((column) => (
                <th key={column.label} className="px-3 py-2 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {YEARS.map((year) => (
              <tr key={year} className="border-b border-stone-200 last:border-0">
                <td className="px-3 py-2 font-medium">{year}</td>
                {COLUMNS.map((column) => {
                  const cell =
                    byCell.get(`${year}|${column.kind}|${column.subject}`) ?? [];
                  return (
                    <td key={column.label} className="px-3 py-2 align-top">
                      {cell.length === 0 ? (
                        <span className="text-stone-300">—</span>
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
                                  className="group inline-flex items-baseline gap-2 hover:underline"
                                >
                                  <span
                                    className={
                                      done
                                        ? "font-semibold text-green-700"
                                        : "font-semibold text-stone-900"
                                    }
                                  >
                                    {progress.done}/{progress.total}
                                  </span>
                                  {exam.session && (
                                    <span className="text-xs text-stone-500">
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
      <p className="text-xs text-stone-500">
        Progresul arată problemele de departajare rezolvate singur / total pe
        examen.
      </p>
    </div>
  );
}
