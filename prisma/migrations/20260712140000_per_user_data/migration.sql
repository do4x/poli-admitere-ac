-- Pre-auth grila attempts have no owner (smoke-test data) — drop before NOT NULL.
DELETE FROM "AnswerAttempt";

-- AlterTable
ALTER TABLE "AnswerAttempt" ADD COLUMN "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Solution" ADD COLUMN "userId" TEXT NOT NULL,
ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX "AnswerAttempt_problemId_createdAt_idx";

-- CreateIndex
CREATE INDEX "AnswerAttempt_userId_problemId_idx" ON "AnswerAttempt"("userId", "problemId");

-- CreateIndex
CREATE INDEX "Solution_userId_idx" ON "Solution"("userId");

-- AddForeignKey
ALTER TABLE "AnswerAttempt" ADD CONSTRAINT "AnswerAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
