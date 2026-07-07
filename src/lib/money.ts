export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function signedAmount(
  amount: number,
  categoryType: "INCOME" | "EXPENSE",
): number {
  return categoryType === "EXPENSE" ? -Math.abs(amount) : Math.abs(amount);
}
