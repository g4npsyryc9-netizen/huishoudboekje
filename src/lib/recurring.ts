export interface RecurringRuleLike {
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  lastGeneratedOn: Date | null;
}

/**
 * Returns the list of due dates (one per month, on dayOfMonth) between
 * the later of startDate/lastGeneratedOn+1month and today (inclusive),
 * excluding any month whose due date is after endDate or in the future.
 */
export function generateDueDates(
  rule: RecurringRuleLike,
  today: Date,
): Date[] {
  const dates: Date[] = [];

  let cursorYear: number;
  let cursorMonth: number;

  if (rule.lastGeneratedOn) {
    cursorYear = rule.lastGeneratedOn.getFullYear();
    cursorMonth = rule.lastGeneratedOn.getMonth() + 1; // start the month after
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  } else {
    cursorYear = rule.startDate.getFullYear();
    cursorMonth = rule.startDate.getMonth();
  }

  while (true) {
    const due = new Date(cursorYear, cursorMonth, rule.dayOfMonth);

    if (due > today) break;
    if (rule.endDate && due > rule.endDate) break;
    if (due >= rule.startDate) dates.push(due);

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return dates;
}
