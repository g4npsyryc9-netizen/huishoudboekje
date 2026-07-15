// Parse a "YYYY-MM-DD" input as local-time components, matching how
// generateDueDates and month-filter queries build their dates —
// new Date("YYYY-MM-DD") would parse as UTC midnight instead, causing
// off-by-one-day mismatches against local-time comparisons elsewhere.
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Format a local Date back to "YYYY-MM-DD" string using local components,
// not toISOString() which would shift the date for positive-UTC-offset timezones.
// The inverse of parseLocalDate.
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
