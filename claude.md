# CLAUDE.md — Departaj (UPB Admission Prep Vault)

## What this is

A **local-only, single-user** app for mastering UPB (Politehnica București) admission & pre-admission exam problems in **Mathematics** and **Informatics**, years **2015–2026**. The owner (Denis) imports problems as LaTeX, marks the hard "departajare" (tiebreaker) problems, uploads handwritten solution PDFs, and gets forced spaced-review of anything he solved with AI assistance.

**The single most important UI element:** a large counter on the dashboard — **"n departajare problems remaining"** — where n = departajare problems with zero valid *independent* solutions. This number must go to 0 before July 24, 2026 (UPB exam date).

## Non-goals (do NOT build these)

- No OCR / image-to-LaTeX conversion. LaTeX arrives pre-converted via the import format below.
- No authentication, no multi-user, no deployment. Localhost only.
- No mobile app, no PWA install prompts, no offline sync.
- No gamification beyond the counter and due-queue. Keep it austere and fast.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | Owner's home turf |
| DB | SQLite via Prisma | Single file: `data/departaj.db` |
| Math rendering | KaTeX (`react-katex` or direct) | Render on problem view; support `$...$` and `$$...$$` |
| Code rendering | Shiki or Prism | Informatics problems contain C++ blocks |
| File storage | Local filesystem: `data/solutions/{problemId}/{timestamp}.pdf` | Never store PDFs in the DB |
| Email | Resend | For 4-day review notifications |
| Styling | Tailwind | Clean, dense, keyboard-friendly |
| Tests | Vitest | Business rules MUST have unit tests (see Testing) |

## Data model (Prisma)

```prisma
model Exam {
  id        String    @id @default(cuid())
  year      Int                       // 2015..2026
  kind      ExamKind                  // ADMITERE | PREADMITERE
  subject   Subject                   // MATE | INFO
  session   String?                   // e.g. "iulie", "sesiunea 1" — nullable
  problems  Problem[]
  @@unique([year, kind, subject, session])
}

model Problem {
  id             String     @id @default(cuid())
  examId         String
  exam           Exam       @relation(fields: [examId], references: [id])
  number         String                 // "1", "2a", "M1.3" — string, not int
  latex          String                 // full statement, LaTeX + markdown allowed
  isDepartajare  Boolean    @default(false)
  solutions      Solution[]
  createdAt      DateTime   @default(now())
  @@unique([examId, number])
}

model Solution {
  id           String    @id @default(cuid())
  problemId    String
  problem      Problem   @relation(fields: [problemId], references: [id])
  pdfPath      String                    // relative path under data/solutions/
  submittedAt  DateTime  @default(now()) // AUTOMATIC — never user-editable
  aiAssisted   Boolean   @default(false)
  reviewDueAt  DateTime?                 // = submittedAt + 4 days IFF aiAssisted
  notifiedAt   DateTime?                 // when the review email was sent (dedupe)
}
```

## Business rules (test these exhaustively)

1. **Independent solution** = a `Solution` with `aiAssisted = false`.
2. A departajare problem counts as **done** iff it has ≥ 1 independent solution. AI-assisted solutions never count toward done.
3. **Remaining counter** `n` = count of problems where `isDepartajare = true` AND no independent solution exists.
4. When a solution is submitted with `aiAssisted = true`, set `reviewDueAt = submittedAt + 4 days`.
5. **Due queue** = AI-assisted solutions where `reviewDueAt <= now()` AND the problem still has no independent solution. Submitting an independent solution for that problem clears it from the queue permanently.
6. `submittedAt` is set server-side at upload time. There is no UI to edit it. This is a commitment device, not a convenience.
7. Multiple solutions per problem are allowed and expected (re-solving over time). Show them as a chronological timeline on the problem page.

## Notification engine (Resend)

Local app ⇒ no guaranteed uptime. Therefore:

- **On app startup** (server boot): run `checkDueReviews()`.
- **While running**: re-run every 6 hours (simple `setInterval` in an instrumentation hook is fine; don't over-engineer with node-cron).
- `checkDueReviews()`: find due-queue items with `notifiedAt = null`, send ONE digest email listing all of them (problem number, exam, year, link to `http://localhost:3000/problems/{id}`), then stamp `notifiedAt`. One digest, not one email per problem.
- Env vars: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `RESEND_FROM`.
- Email copy: direct, zero fluff. Subject: `"{n} probleme de rezolvat singur — Departaj"`.

## Problem import format (critical — this is the pipeline contract)

Problems are converted from PNG/PDF to LaTeX **outside this app** (by Claude in chat). The app ingests JSON files dropped into `import/`:

```json
{
  "exam": { "year": 2024, "kind": "ADMITERE", "subject": "MATE", "session": "iulie" },
  "problems": [
    {
      "number": "1",
      "isDepartajare": false,
      "latex": "Fie $f:\\mathbb{R}\\to\\mathbb{R}$, $f(x)=x^2-4x+3$. ..."
    }
  ]
}
```

Build:
- `npm run import` — CLI script that validates (Zod), upserts by `(exam unique key, problem number)`, and reports created/updated/skipped. Idempotent: re-importing the same file must be a no-op.
- A drag-drop import page at `/import` that accepts the same JSON.

Escape rule: JSON strings contain LaTeX ⇒ backslashes are doubled (`\\mathbb`). The importer must NOT double-unescape.

## Pages

- `/` **Dashboard** — the big `n` counter, due-review queue (red, top), recent solutions, per-year progress bars (departajare done/total per exam).
- `/exams` — grid: years × (kind, subject). Each cell shows departajare progress like `3/5`.
- `/exams/[id]` — problem list; departajare rows visually distinct (border/badge); toggle `isDepartajare` inline.
- `/problems/[id]` — KaTeX-rendered statement; solution timeline (each entry: date, AI badge if assisted, embedded PDF viewer via `<iframe>`); upload zone with an explicit `aiAssisted` checkbox ("Am rezolvat cu ajutorul AI") — unchecked by default.
- `/import` — drag-drop JSON import with a dry-run preview before commit.

## Conventions

- TypeScript strict. No `any`.
- Business rules live in `src/lib/domain/` as pure functions (e.g. `remainingCount(problems)`, `dueReviews(solutions, now)`) — pure, injectable `now`, fully unit-tested with Vitest **before** wiring UI.
- Server Actions for mutations; no separate API layer unless needed.
- Commits: conventional (`feat:`, `fix:`, `test:`). Small, atomic.
- Romanian in UI copy, English in code.

## Definition of done (v1)

1. `npm run dev` boots with an empty DB and shows `n = 0` gracefully.
2. Importing a sample JSON creates exams + problems; re-import is a no-op.
3. Uploading a PDF stores the file, timestamps automatically, and updates `n`.
4. AI-assisted upload creates a review due in exactly 96 hours (unit-tested with fake clock).
5. Digest email fires once and only once per due item (dedupe tested).
6. All domain functions covered by Vitest.

Build in this order: schema → domain functions + tests → importer → problem/solution pages → dashboard → notifications.