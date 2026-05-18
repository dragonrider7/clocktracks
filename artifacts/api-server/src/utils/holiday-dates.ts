export type HolidayForCompute = {
  id: number;
  name: string;
  hoursPerDay: number;
  date: string | null;
  recurrenceType: string;
  recurrenceMonth: number | null;
  recurrenceDayOfMonth: number | null;
  recurrenceWeekday: number | null;
  recurrenceNth: number | null;
};

/**
 * Compute the concrete date (YYYY-MM-DD) for a holiday in a specific year.
 * Returns null if not computable.
 */
export function computeHolidayDate(h: HolidayForCompute, year: number): string | null {
  if (h.recurrenceType === "none") return h.date ?? null;

  if (h.recurrenceType === "fixed") {
    const m = h.recurrenceMonth!;
    const d = h.recurrenceDayOfMonth!;
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  if (h.recurrenceType === "nth_weekday") {
    const month = h.recurrenceMonth!;
    const targetWd = h.recurrenceWeekday!; // 0=Sun … 6=Sat
    const nth = h.recurrenceNth!;          // 1–5 or -1 for "last"

    if (nth === -1) {
      // Last occurrence: iterate backwards from last day of month
      const lastDay = new Date(year, month, 0).getDate();
      for (let d = lastDay; d >= 1; d--) {
        if (new Date(year, month - 1, d).getDay() === targetWd) {
          return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
      }
    } else {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, month - 1, d);
        if (dt.getMonth() !== month - 1) break;
        if (dt.getDay() === targetWd) {
          count++;
          if (count === nth) {
            return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Return all concrete dates a holiday falls on within [startStr, endStr] (inclusive).
 * Handles both one-time and recurring holidays.
 */
export function expandHolidayInRange(
  h: HolidayForCompute,
  startStr: string,
  endStr: string
): string[] {
  if (h.recurrenceType === "none") {
    const d = h.date;
    return d && d >= startStr && d <= endStr ? [d] : [];
  }

  const startYear = parseInt(startStr.slice(0, 4), 10);
  const endYear = parseInt(endStr.slice(0, 4), 10);
  const results: string[] = [];

  for (let yr = startYear; yr <= endYear; yr++) {
    const d = computeHolidayDate(h, yr);
    if (d && d >= startStr && d <= endStr) results.push(d);
  }

  return results;
}

/** Human-readable description of a holiday's recurrence rule. */
export function recurrenceLabel(h: HolidayForCompute): string {
  if (h.recurrenceType === "none") return h.date ?? "One-time";

  const MONTHS = ["", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "Last" };

  const monthName = MONTHS[h.recurrenceMonth ?? 0] ?? "";

  if (h.recurrenceType === "fixed") {
    return `Every year on ${monthName} ${h.recurrenceDayOfMonth}`;
  }

  if (h.recurrenceType === "nth_weekday") {
    const ord = ORDINALS[h.recurrenceNth!] ?? `${h.recurrenceNth}th`;
    const wd = WEEKDAYS[h.recurrenceWeekday!] ?? "";
    return `Every year on the ${ord} ${wd} of ${monthName}`;
  }

  return "Recurring";
}
