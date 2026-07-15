import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "@/lib/constants";

export function matchCategory(
  description: string,
  rules: { keyword: string; categoryId: string }[],
  direction: "IN" | "AF",
): string {
  const lowerDescription = description.toLowerCase();
  const match = rules.find((rule) =>
    lowerDescription.includes(rule.keyword.toLowerCase()),
  );
  if (match) return match.categoryId;
  return direction === "IN"
    ? FALLBACK_INCOME_CATEGORY_ID
    : FALLBACK_EXPENSE_CATEGORY_ID;
}
