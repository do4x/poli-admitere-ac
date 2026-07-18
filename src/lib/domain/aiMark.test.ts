import { describe, expect, it } from "vitest";
import { aiPhase } from "./aiMark";

const NOW = new Date("2026-04-10T09:00:00.000Z");
const PAST = new Date("2026-04-09T09:00:00.000Z");
const FUTURE = new Date("2026-04-11T09:00:00.000Z");

describe("aiPhase", () => {
  it("is null without a mark", () => {
    expect(aiPhase(null, NOW)).toBeNull();
    expect(aiPhase(undefined, NOW)).toBeNull();
  });

  it("is 'window' while dueAt lies in the future", () => {
    expect(aiPhase({ dueAt: FUTURE, redeemedAt: null }, NOW)).toBe("window");
  });

  it("is 'due' from the exact deadline on", () => {
    expect(aiPhase({ dueAt: NOW, redeemedAt: null }, NOW)).toBe("due");
    expect(aiPhase({ dueAt: PAST, redeemedAt: null }, NOW)).toBe("due");
  });

  it("is 'redeemed' once stamped, regardless of the deadline", () => {
    expect(aiPhase({ dueAt: PAST, redeemedAt: NOW }, NOW)).toBe("redeemed");
    expect(aiPhase({ dueAt: FUTURE, redeemedAt: NOW }, NOW)).toBe("redeemed");
  });
});
