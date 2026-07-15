export function markDuplicates<
  T extends { date: Date; description: string; amount: number },
>(
  rows: T[],
  existing: { date: Date; description: string; amount: number }[],
): (T & { isDuplicate: boolean })[] {
  return rows.map((row) => {
    const isDuplicate = existing.some(
      (e) =>
        e.date.getTime() === row.date.getTime() &&
        e.description === row.description &&
        e.amount === row.amount,
    );
    return { ...row, isDuplicate };
  });
}
