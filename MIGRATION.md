# Migration Plan — Departaj: local single-user → hosted multi-user (~1000 users)

> Draft 2026-07-11. Target: promote to the UPB subreddit.
> Status: PLAN ONLY — nothing here is built yet. Supersedes CLAUDE.md's
> "localhost only, no auth" non-goals when executed.

## Goal & principles

- Let ~1000 UPB candidates use the curated problem bank, topic filters,
  grila answer-check, and (optionally) the PDF + forced-review workflow.
- **Shared content, private work.** Exams / Problems / Tags / answer keys are
  global, admin-curated (Denis). Solutions, attempts, review queues are per-user.
- **Keep the commitment device.** "Rezolvată singur" still requires an
  independent written solution. A correct grila answer is a weaker,
  distinct state and never satisfies the departajare counter.
- Domain functions stay pure; multi-user is a *query scoping* change,
  not a business-logic rewrite.

## Stack decision

**Supabase (Postgres + Auth + Storage) + Prisma (unchanged ORM) + Vercel + Resend.**

One provider for the three hard problems (DB, auth, private file storage),
free tier comfortably covers 1000 students, and Prisma stays. Enforcement
lives in Server Actions (ownership checks on every query) because Prisma
connects directly to Postgres; Supabase RLS + private bucket policies act
as defense-in-depth, not the primary gate.

*Considered alternative:* Auth.js + Neon + Cloudflare R2 — more control,
three providers to wire and operate. Not worth it solo.

## Target architecture

```
Browser ── Vercel (Next 15 App Router, Server Actions)
              │  Prisma (pgbouncer :6543 / directUrl :5432)
              ├── Supabase Postgres   (exams, problems, tags, users, solutions, attempts)
              ├── Supabase Auth       (Google OAuth + email magic link, @supabase/ssr cookies)
              ├── Supabase Storage    (private bucket "solutions", signed URLs, path userId/problemId/ts.pdf)
              ├── Resend              (per-user review digests; verified custom domain)
              └── Cron (external ping or Vercel Cron) → /api/cron/reviews (CRON_SECRET)
```

## Access model

| Surface | Anonymous | Logged-in | Admin (Denis) |
|---|---|---|---|
| Browse /probleme, /exams, statements, tags | ✅ read | ✅ | ✅ |
| Grila answer-check | ❌ (login prompt) | ✅ | ✅ |
| Upload solutions, dashboard, review queue | ❌ | ✅ (own data only) | ✅ |
| Toggle departajare, tag management, import | ❌ | ❌ | ✅ |

Public browsing is deliberate: it is the reddit funnel. First interaction
(checking an answer) is the signup moment.

## Schema changes (sketch)

```prisma
model User {
  id        String   @id            // = Supabase auth.users.id (uuid)
  email     String   @unique
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
  solutions Solution[]
  attempts  AnswerAttempt[]
}

model Solution {
  // existing fields...
  userId String
  user   User @relation(fields: [userId], references: [id])
  // pdfPath becomes a Storage object path, not a filesystem path
}

model Problem {
  // existing fields...
  correctAnswer String?          // "a".."f" — admin-imported, NEVER sent to client
  attempts      AnswerAttempt[]
}

model AnswerAttempt {
  id        String   @id @default(cuid())
  problemId String
  userId    String
  kind      AttemptKind // CHOICE | REVEAL
  choice    String?     // "a".."f" when kind = CHOICE
  correct   Boolean?    // server-computed at submit time
  createdAt DateTime @default(now())
  @@index([userId, problemId])
}
```

Note: Postgres treats NULLs as distinct in unique indexes exactly like
SQLite, so the `session: null` findFirst pattern in `run.ts`/`tagsRun.ts`
carries over unchanged.

## Phases

### Phase 0 — Branch & Postgres locally (~½ day)
- Branch `feat/multi-user` (off master, after design/refresh merges).
- Create Supabase project; `provider = "postgresql"`, `DATABASE_URL`
  (pgbouncer) + `directUrl`. Switch from `db push` to `prisma migrate dev`
  (baseline migration) — migrations become mandatory once real users exist.
- **Data migration is trivial today**: the import pipeline is the migration
  tool. Re-run `npm run import` (all import/*.json) + `npm run import:tags --
  import/tags-classification.json --apply` against Postgres. Zero solutions
  exist yet; if some do by execution time, write a one-off copy script.
- Verify: 127 tests green against Postgres test DB (adjust run.test.ts
  temp-DB bootstrap to spin a Postgres schema or keep SQLite for pure tests).

### Phase 1 — Auth (~2 days)
- Supabase Auth: Google provider + email magic link. `@supabase/ssr`
  middleware for session refresh; `getUser()` in server actions/pages.
- On first login: upsert `User` row from auth identity; `isAdmin=true`
  seeded for Denis's email.
- Gate per the access-model table. Login page, logout, minimal account page.
- Admin-only: `toggleDepartajare`, taxonomy actions, /import, import CLIs.
- Verify: two test accounts can't see each other's anything.

### Phase 2 — Per-user data & PDF storage (~2–3 days)
- Add `userId` to Solution; scope every solution/dashboard/dueQueue/solveState
  query by the session user. Domain functions unchanged (pure).
- Private Storage bucket `solutions`; upload via server action (service
  role), 10 MB cap, keep the `%PDF` magic check; store object path in DB.
- Replace `/api/solutions/[id]` with: auth → ownership check → 60s signed
  URL redirect. (Fixes the current unauthenticated-PDF hole.)
- Per-user quotas: e.g. 100 PDFs / 500 MB per user, checked at upload.
- Verify: user A's PDF URL fails for user B, even with the raw storage path.

### Phase 3 — Notifications (~½–1 day)
- Delete the `setInterval` instrumentation path (keep for `NODE_ENV=development`).
- `/api/cron/reviews` route guarded by `CRON_SECRET`; runs checkDueReviews
  **per user**, one digest per user to their own email; `notifiedAt` dedupe
  already exists.
- Scheduler: GitHub Actions cron or cron-job.org every 6h (free) — Vercel
  Hobby cron is daily-only; Vercel Pro unlocks native 6h cron.
- Resend: verify a real domain (SPF/DKIM) — needed to email arbitrary users.
- Verify: fake-clock test already covers dedupe; manual end-to-end with two users.

### Phase 4 — Grila answer-check (~2 days + content pass)
See "Grila module" below. Can be built before or in parallel with Phases 1–3
(works single-user first; gains `userId` in Phase 2 like everything else).

### Phase 5 — Hardening & legal (~1–2 days)
- Rate limits in server actions (DB-timestamp based): attempts/min,
  uploads/day, tag mutations admin-only anyway.
- Account deletion: server action deletes attempts, solutions, storage
  objects, User row, Supabase auth user. GDPR: one-paragraph privacy note
  (what's stored: email, uploads, attempts; how to delete).
- Error boundary pages, 404s, basic logging (Vercel logs suffice).

### Phase 6 — Deploy & launch (~1 day)
- Vercel project, env vars (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`,
  `RESEND_API_KEY`, `CRON_SECRET`), custom domain, `prisma migrate deploy`
  in build.
- Seed prod via import pipeline (same as Phase 0).
- Smoke checklist: signup (both providers), attempt, upload, signed URL,
  cron digest, account deletion.
- Reddit post + feedback channel (GitHub issues or a form).

**Total effort: ~8–10 focused days.**

## Grila module (answer-check) — design

**Flow:** on a problem page, logged-in user picks a)–f) → server action
compares against `Problem.correctAnswer` **server-side** → stores
AnswerAttempt → returns corect/greșit. Wrong answers don't reveal the key;
retry allowed (rate-limited). Optional „Arată răspunsul" records a REVEAL
attempt.

**State ladder** (per user, per problem) — extends `solveState`:

| State | Condition | Color (outline + badge) |
|---|---|---|
| `nerezolvata` | nothing | red |
| `grila` — „verificată pe grilă" | correct CHOICE attempt, no REVEAL before it, no solution PDF | teal/cyan (avoids clash with subject-blue spine) |
| `doar_ai` | solutions exist, none independent | orange |
| `singur` | ≥1 independent solution | green |

Rules:
- The departajare counter is **unchanged** — independent PDF only. Grila
  never counts as done; it's self-check, not proof of a written solve.
- A REVEAL permanently blocks `grila` state for that problem (you can't
  self-verify with a known answer) — but a later independent PDF still
  reaches `singur`.
- `correctAnswer` must never be serialized into page props / RSC payload.
  Comparison happens only inside the server action.

**Answer-key content pass:** extend the import contract with optional
`"answer": "a"` per problem + an answers-only import file mirroring the
tags importer (plan/run/CLI, dry-run default, idempotent). Keys come from
the official baremuri in the year PDF folders; problems without a known key
simply hide the grila UI („răspuns indisponibil"). Same workflow as the
tag classification: export → extract → dry-run → apply.

## Costs (monthly, ~1000 users)

| Item | Cost |
|---|---|
| Supabase (free tier: 500MB DB, 1GB storage, 50k MAU auth) | $0 → $25 if storage/DB outgrows |
| Vercel Hobby (or Pro for native 6h cron + higher limits) | $0 → $20 |
| Resend (past 100/day free) | ~$20 |
| Domain (.ro) | ~$1 (≈€10/yr) |
| **Realistic total** | **$20–65/mo** |

PDF storage is the growth axis: 1000 users × 25 uploads × 1MB ≈ 25GB →
Supabase Storage paid tier or move bucket to R2 ($0.36/mo for 25GB). Not a
launch concern.

## Risks / open questions

1. **Support burden** — public app = DMs, bug reports, abuse (junk PDF
   uploads), deletion requests. Decide you want this before Phase 1.
2. **run.test.ts on Postgres** — temp-DB bootstrap must change (Testcontainers,
   a Supabase branch DB, or keep SQLite for the pure-logic integration tests
   and add a thin Postgres smoke test).
3. **Answer-key accuracy** — a wrong key is worse than no key. Dry-run diff +
   spot-checks like the tag classification; user "report answer" button cheap
   to add later.
4. **Anonymous grila?** Current call: require login (funnel + rate limiting).
   Could soften to N free anonymous checks later.
5. **Copyright** — problem statements are official exam subjects, publicly
   published by UPB; attribution note in footer. Low risk, worth the note.
