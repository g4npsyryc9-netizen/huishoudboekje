import { describe, it, expect } from "vitest";
import { markDuplicates } from "@/lib/csv/duplicate-detect";

describe("markDuplicates", () => {
  const existing = [
    { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 25.5 },
  ];

  it("marks an exact match as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 25.5 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(true);
  });

  it("does not mark a row with a different amount as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 30 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(false);
  });

  it("does not mark a row with a different date as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 16), description: "ALBERT HEIJN 1234", amount: 25.5 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(false);
  });
});
