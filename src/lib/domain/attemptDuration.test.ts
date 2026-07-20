import { describe, expect, it } from "vitest";
import { attemptDuration, DEFAULT_MAX_GAP_MS } from "./attemptDuration";

const T0 = new Date("2026-07-19T10:00:00.000Z");
const at = (offsetSeconds: number) =>
  new Date(T0.getTime() + offsetSeconds * 1000);

const correct = (offsetSeconds: number) =>
  ({ kind: "CHOICE", correct: true, createdAt: at(offsetSeconds) }) as const;
const wrong = (offsetSeconds: number) =>
  ({ kind: "CHOICE", correct: false, createdAt: at(offsetSeconds) }) as const;
const reveal = (offsetSeconds: number) =>
  ({ kind: "REVEAL", correct: null, createdAt: at(offsetSeconds) }) as const;

describe("attemptDuration", () => {
  it("is null with no attempts", () => {
    expect(attemptDuration([])).toBeNull();
  });

  it("is 0 when correct on the 1st try — the anchor has nothing before it", () => {
    expect(attemptDuration([correct(0)])).toBe(0);
  });

  it("is t2 − t1 when correct on the 2nd try", () => {
    expect(attemptDuration([wrong(0), correct(30)])).toBe(30_000);
  });

  it("sums consecutive gaps up to the n-th (correct) try", () => {
    expect(attemptDuration([wrong(0), wrong(45), correct(70)])).toBe(70_000);
  });

  it("is null when never correct", () => {
    expect(attemptDuration([wrong(0), wrong(30)])).toBeNull();
  });

  it("is null when a reveal precedes the correct choice — timing is tainted", () => {
    expect(attemptDuration([reveal(0), correct(10)])).toBeNull();
    expect(attemptDuration([wrong(0), reveal(5), correct(10)])).toBeNull();
  });

  it("ignores attempts after the first correct one (reveals included)", () => {
    expect(attemptDuration([wrong(0), correct(20), reveal(25)])).toBe(20_000);
    expect(attemptDuration([correct(0), wrong(9999)])).toBe(0);
  });

  it("excludes gaps over maxGapMs — a session break is not thinking time", () => {
    const twoDays = 2 * 24 * 3600;
    expect(attemptDuration([wrong(0), correct(twoDays)])).toBe(0);
    // 60s of real work, then resumed two days later: only the 60s count.
    expect(attemptDuration([wrong(0), wrong(60), correct(60 + twoDays)])).toBe(
      60_000,
    );
  });

  it("keeps a gap exactly at the maxGapMs boundary", () => {
    const boundary = DEFAULT_MAX_GAP_MS / 1000;
    expect(attemptDuration([wrong(0), correct(boundary)])).toBe(
      DEFAULT_MAX_GAP_MS,
    );
    expect(attemptDuration([wrong(0), correct(boundary + 1)])).toBe(0);
  });

  it("honours a custom maxGapMs", () => {
    expect(attemptDuration([wrong(0), correct(120)], 60_000)).toBe(0);
    expect(attemptDuration([wrong(0), correct(45)], 60_000)).toBe(45_000);
  });
});
