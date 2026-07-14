import { prisma } from "../src/lib/db";

async function main() {
  const total = await prisma.problem.count();
  const missing = await prisma.problem.findMany({
    where: { OR: [{ correctAnswer: null }, { correctAnswer: "" }] },
    include: { exam: true },
    orderBy: [{ exam: { subject: "asc" } }, { exam: { year: "asc" } }],
  });
  const withAnswer = total - missing.length;
  console.log(
    JSON.stringify(
      {
        total,
        withAnswer,
        missing: missing.length,
        byYear: Object.entries(
          missing.reduce<Record<string, number>>((acc, p) => {
            const k = `${p.exam.subject} ${p.exam.year} ${p.exam.kind}${p.exam.session ? " " + p.exam.session : ""}`;
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {}),
        ),
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
