-- CreateTable
CREATE TABLE "AiMark" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "AiMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMark_problemId_userId_key" ON "AiMark"("problemId", "userId");

-- CreateIndex
CREATE INDEX "AiMark_userId_idx" ON "AiMark"("userId");

-- AddForeignKey
ALTER TABLE "AiMark" ADD CONSTRAINT "AiMark_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMark" ADD CONSTRAINT "AiMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-all posture as every other table: the app reaches Postgres only
-- through the BYPASSRLS prisma role.
ALTER TABLE "AiMark" ENABLE ROW LEVEL SECURITY;

-- Backfill: one mark per (user, problem) that already has AI-assisted
-- solutions. markedAt = first AI upload; dueAt = markedAt + 72h (the review
-- window shrank from 96h on 2026-07-18); notifiedAt carries over so already
-- nagged items are not re-emailed; a pre-existing independent solution counts
-- as redemption so those never enter the due queue.
INSERT INTO "AiMark" ("id", "problemId", "userId", "markedAt", "dueAt", "notifiedAt", "redeemedAt")
SELECT
    md5(s."problemId" || '|' || s."userId"),
    s."problemId",
    s."userId",
    MIN(s."submittedAt"),
    MIN(s."submittedAt") + interval '72 hours',
    MAX(s."notifiedAt"),
    (SELECT MIN(i."submittedAt") FROM "Solution" i
       WHERE i."problemId" = s."problemId"
         AND i."userId" = s."userId"
         AND i."aiAssisted" = false)
FROM "Solution" s
WHERE s."aiAssisted" = true
GROUP BY s."problemId", s."userId";
