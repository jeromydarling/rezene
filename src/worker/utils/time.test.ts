import { describe, it, expect } from "vitest";
import { isExpired } from "./time";

describe("isExpired", () => {
  const now = "2026-07-12T14:00:00.000Z";

  it("treats a future ISO timestamp as not expired", () => {
    expect(isExpired("2026-07-12T16:00:00.000Z", now)).toBe(false);
  });
  it("treats a past ISO timestamp as expired", () => {
    expect(isExpired("2026-07-12T12:00:00.000Z", now)).toBe(true);
  });

  // The regression this helper exists to prevent: a space-formatted SQLite
  // datetime sorts BEFORE an ISO 'T' timestamp of the same instant, so a fresh
  // session's expiry would read as already in the past. Storing ISO everywhere
  // keeps the string comparison correct.
  it("compares two ISO timestamps of the same shape correctly", () => {
    const future = new Date(Date.parse(now) + 2 * 3600 * 1000).toISOString();
    expect(isExpired(future, now)).toBe(false);
  });
  it("would misjudge a space-formatted expiry — documents why we store ISO", () => {
    // ' ' (0x20) < 'T' (0x54): the same instant in space format sorts earlier.
    expect("2026-07-12 16:00:00" < now).toBe(true); // WRONG if used as expiry
    // ...whereas the ISO form of that instant is correctly in the future:
    expect(isExpired("2026-07-12T16:00:00.000Z", now)).toBe(false);
  });
});
