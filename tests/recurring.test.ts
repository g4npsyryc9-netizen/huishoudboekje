import { describe, it, expect } from "vitest";
import { generateDueDates } from "@/lib/recurring";

describe("generateDueDates", () => {
  it("generates one date for the current month if never generated and day has passed", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1), // 1 jan 2026
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 0, 15), // 15 jan 2026
    );
    expect(dates).toEqual([new Date(2026, 0, 1)]);
  });

  it("does not generate a date for a day that hasn't passed yet this month", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 28,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 0, 15),
    );
    expect(dates).toEqual([]);
  });

  it("backfills multiple missed months", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 2, 15), // 15 mrt 2026, 3 maanden gemist
    );
    expect(dates).toEqual([
      new Date(2026, 0, 1),
      new Date(2026, 1, 1),
      new Date(2026, 2, 1),
    ]);
  });

  it("only generates months after lastGeneratedOn", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: new Date(2026, 1, 1), // feb al gegenereerd
      },
      new Date(2026, 2, 15),
    );
    expect(dates).toEqual([new Date(2026, 2, 1)]);
  });

  it("stops generating after endDate", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 15), // eindigt half feb
        lastGeneratedOn: null,
      },
      new Date(2026, 2, 15),
    );
    expect(dates).toEqual([new Date(2026, 0, 1), new Date(2026, 1, 1)]);
  });
});
