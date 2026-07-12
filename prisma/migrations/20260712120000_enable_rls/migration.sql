-- Defense-in-depth: the app reaches Postgres only through the "prisma" role
-- (BYPASSRLS). RLS enabled with zero policies = deny-all for any other path
-- (PostgREST anon/authenticated, future Supabase client access). Real
-- policies arrive with multi-user work if/when the Supabase client is used.
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Problem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnswerAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Solution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_ProblemToTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
