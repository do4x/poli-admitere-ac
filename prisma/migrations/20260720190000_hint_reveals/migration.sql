-- CreateTable
CREATE TABLE "HintReveal" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintReveal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HintReveal_problemId_userId_level_key" ON "HintReveal"("problemId", "userId", "level");

-- CreateIndex
CREATE INDEX "HintReveal_userId_idx" ON "HintReveal"("userId");

-- AddForeignKey
ALTER TABLE "HintReveal" ADD CONSTRAINT "HintReveal_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintReveal" ADD CONSTRAINT "HintReveal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-all posture as every other table: the app reaches Postgres only
-- through the BYPASSRLS prisma role.
ALTER TABLE "HintReveal" ENABLE ROW LEVEL SECURITY;
