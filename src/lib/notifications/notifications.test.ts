import { describe, expect, it, vi } from "vitest";
import { buildDigest, digestSubject, type Digest } from "./digest";
import {
  checkDueReviews,
  type NotifiableMark,
  type NotifiableProblem,
} from "./checkDueReviews";

const NOW = new Date("2026-04-10T09:00:00.000Z");
const PAST = new Date("2026-04-09T09:00:00.000Z");
const FUTURE = new Date("2026-04-11T09:00:00.000Z");

const exam = {
  year: 2025,
  kind: "PREADMITERE",
  subject: "MATE",
  session: "5 aprilie — Varianta A",
};

let markSeq = 0;
function aiMark(
  dueAt: Date,
  notifiedAt: Date | null = null,
  redeemedAt: Date | null = null,
): NotifiableMark {
  markSeq += 1;
  return { id: `mark-${markSeq}`, dueAt, redeemedAt, notifiedAt };
}

function problem(
  id: string,
  mark: NotifiableMark | null,
  solutions: NotifiableProblem["solutions"] = [{ aiAssisted: true }],
): NotifiableProblem {
  return { id, number: id.replace("prob-", ""), exam, solutions, aiMark: mark };
}

function makeDeps(problems: NotifiableProblem[]) {
  const send = vi.fn(async (_digest: Digest) => {});
  const stampNotified = vi.fn(async (_ids: string[], _at: Date) => {});
  return {
    deps: {
      now: () => NOW,
      loadProblems: async () => problems,
      send,
      stampNotified,
    },
    send,
    stampNotified,
  };
}

describe("digest", () => {
  it("uses the exact required subject line", () => {
    expect(digestSubject(3)).toBe("3 probleme de rezolvat singur — Departaj");
  });

  it("lists each problem once with its slug link", () => {
    const p = { id: "abc", number: "7", exam };
    const digest = buildDigest([p, p]);
    expect(digest.problemCount).toBe(1);
    expect(digest.subject).toBe("1 probleme de rezolvat singur — Departaj");
    expect(digest.text).toContain(
      "Problema 7 — PREADMITERE MATE 2025 (5 aprilie — Varianta A)",
    );
    expect(digest.text).toContain(
      "http://localhost:3000/pb7-mate/preadmitere/2025",
    );
    expect(digest.text.match(/pb7-mate/g)).toHaveLength(1);
  });

  it("explains the 72h reset and the way back", () => {
    const digest = buildDigest([{ id: "x", number: "1", exam }]);
    expect(digest.text).toContain("Au trecut 3 zile");
    expect(digest.text).toContain("grilă");
  });

  it("omits the session suffix when session is null", () => {
    const digest = buildDigest([
      { id: "x", number: "1", exam: { ...exam, session: null } },
    ]);
    expect(digest.text).toContain("Problema 1 — PREADMITERE MATE 2025\n");
    expect(digest.text).not.toContain("()");
  });
});

describe("checkDueReviews", () => {
  it("sends one digest and stamps every due mark", async () => {
    const p1 = problem("prob-1", aiMark(PAST));
    const p2 = problem("prob-2", aiMark(NOW));
    const { deps, send, stampNotified } = makeDeps([p1, p2]);

    const result = await checkDueReviews(deps);

    expect(result.sent).toBe(true);
    expect(result.problemCount).toBe(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(stampNotified).toHaveBeenCalledTimes(1);
    expect(stampNotified.mock.calls[0]![0]).toHaveLength(2);
    expect(stampNotified.mock.calls[0]![1]).toEqual(NOW);
  });

  it("does nothing when nothing is due", async () => {
    const { deps, send, stampNotified } = makeDeps([
      problem("prob-1", aiMark(FUTURE)),
    ]);
    const result = await checkDueReviews(deps);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(stampNotified).not.toHaveBeenCalled();
  });

  it("never emails twice for the same mark (DoD 5 — dedupe)", async () => {
    const { deps, send } = makeDeps([
      problem("prob-1", aiMark(PAST, PAST)), // already notified
    ]);
    const result = await checkDueReviews(deps);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips marks already redeemed via grila", async () => {
    const { deps, send } = makeDeps([
      problem("prob-1", aiMark(PAST, null, NOW)),
    ]);
    const result = await checkDueReviews(deps);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips problems that meanwhile got an independent solution", async () => {
    const { deps, send } = makeDeps([
      problem("prob-1", aiMark(PAST), [
        { aiAssisted: true },
        { aiAssisted: false },
      ]),
    ]);
    const result = await checkDueReviews(deps);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not stamp when sending fails, so the next cycle retries", async () => {
    const p = problem("prob-1", aiMark(PAST));
    const { deps, stampNotified } = makeDeps([p]);
    deps.send = vi.fn(async () => {
      throw new Error("resend down");
    });
    await expect(checkDueReviews(deps)).rejects.toThrow("resend down");
    expect(stampNotified).not.toHaveBeenCalled();
  });
});
