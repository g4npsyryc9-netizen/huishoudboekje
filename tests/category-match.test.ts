import { describe, it, expect } from "vitest";
import { matchCategory } from "@/lib/csv/category-match";
import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "@/lib/constants";

const rules = [
  { keyword: "Albert Heijn", categoryId: "cat_boodschappen" },
  { keyword: "werkgever", categoryId: "cat_salaris" },
];

describe("matchCategory", () => {
  it("matches case-insensitively on a keyword contained in the description", () => {
    expect(
      matchCategory("ALBERT HEIJN 1234", rules, "AF"),
    ).toBe("cat_boodschappen");
  });

  it("matches a different keyword case-insensitively", () => {
    expect(matchCategory("WERKGEVER BV", rules, "IN")).toBe("cat_salaris");
  });

  it("falls back to the expense fallback category for AF with no match", () => {
    expect(matchCategory("ONBEKENDE WINKEL", rules, "AF")).toBe(
      FALLBACK_EXPENSE_CATEGORY_ID,
    );
  });

  it("falls back to the income fallback category for IN with no match", () => {
    expect(matchCategory("ONBEKENDE BRON", rules, "IN")).toBe(
      FALLBACK_INCOME_CATEGORY_ID,
    );
  });
});
