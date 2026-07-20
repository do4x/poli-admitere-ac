import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

/** The server runs in UTC (Vercel) while every reader is in Romania, so the
 *  formatters pin Europe/Bucharest — otherwise a 12:18 upload renders 09:18.
 *  These assertions hold whatever the test machine's own zone is. */
describe("date formatting is pinned to Europe/Bucharest", () => {
  it("shifts a UTC instant into summer time (UTC+3)", () => {
    expect(formatDateTime(new Date("2026-07-20T09:18:00Z"))).toBe(
      "20 iul. 2026, 12:18",
    );
  });

  it("shifts a UTC instant into winter time (UTC+2)", () => {
    expect(formatDateTime(new Date("2026-01-15T09:18:00Z"))).toBe(
      "15 ian. 2026, 11:18",
    );
  });

  it("rolls the date over when the local day is already the next one", () => {
    expect(formatDate(new Date("2026-07-19T22:30:00Z"))).toBe("20 iul. 2026");
  });
});
