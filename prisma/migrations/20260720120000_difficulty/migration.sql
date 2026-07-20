-- CreateEnum
CREATE TYPE "Archetype" AS ENUM ('BRUTAL', 'INSIGHT', 'GRIND', 'TRAP', 'TRIVIAL', 'STANDARD');

-- CreateTable
CREATE TABLE "Difficulty" (
    "problemId" TEXT NOT NULL,
    "r" DOUBLE PRECISION NOT NULL,
    "e" DOUBLE PRECISION NOT NULL,
    "t" DOUBLE PRECISION NOT NULL,
    "p" DOUBLE PRECISION NOT NULL,
    "k" DOUBLE PRECISION NOT NULL,
    "v" DOUBLE PRECISION NOT NULL,
    "dRaw" DOUBLE PRECISION NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "bandMargin" BOOLEAN NOT NULL DEFAULT false,
    "archetype" "Archetype" NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "trigger" TEXT,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Difficulty_pkey" PRIMARY KEY ("problemId")
);

-- CreateIndex
CREATE INDEX "Difficulty_level_idx" ON "Difficulty"("level");

-- AddForeignKey
ALTER TABLE "Difficulty" ADD CONSTRAINT "Difficulty_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-all posture as every other table: the app reaches Postgres only
-- through the BYPASSRLS prisma role.
ALTER TABLE "Difficulty" ENABLE ROW LEVEL SECURITY;
