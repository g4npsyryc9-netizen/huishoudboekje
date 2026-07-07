import { describe, it, expect } from "vitest";
import { formatEuro, signedAmount } from "@/lib/money";

describe("formatEuro", () => {
  it("formats a whole number with two decimals and a comma", () => {
    expect(formatEuro(25)).toBe("€ 25,00");
  });

  it("formats a number with cents, rounding to two decimals", () => {
    expect(formatEuro(1234.5)).toBe("€ 1.234,50");
  });

  it("formats zero", () => {
    expect(formatEuro(0)).toBe("€ 0,00");
  });
});

describe("signedAmount", () => {
  it("keeps expense amounts positive as stored but returns them negative", () => {
    expect(signedAmount(25.5, "EXPENSE")).toBe(-25.5);
  });

  it("returns income amounts positive", () => {
    expect(signedAmount(100, "INCOME")).toBe(100);
  });
});
