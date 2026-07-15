import { describe, it, expect } from "vitest";
import { parseLocalDate, formatDateInputValue } from "@/lib/date";

describe("parseLocalDate", () => {
  it("parses a YYYY-MM-DD string as local-time midnight", () => {
    const date = parseLocalDate("2026-07-15");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // 0-indexed: July
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
  });
});

describe("formatDateInputValue", () => {
  it("formats a local Date back to YYYY-MM-DD using local components", () => {
    const date = new Date(2026, 6, 15); // 15 juli 2026, local midnight
    expect(formatDateInputValue(date)).toBe("2026-07-15");
  });

  it("round-trips with parseLocalDate", () => {
    const original = "2026-01-05";
    expect(formatDateInputValue(parseLocalDate(original))).toBe(original);
  });

  it("pads single-digit month and day with a leading zero", () => {
    const date = new Date(2026, 0, 3); // 3 januari 2026
    expect(formatDateInputValue(date)).toBe("2026-01-03");
  });
});
