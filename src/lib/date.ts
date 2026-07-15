// Parse a "YYYY-MM-DD" input as local-time components, matching how
// generateDueDates and month-filter queries build their dates —
// new Date("YYYY-MM-DD") would parse as UTC midnight instead, causing
// off-by-one-day mismatches against local-time comparisons elsewhere.
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
