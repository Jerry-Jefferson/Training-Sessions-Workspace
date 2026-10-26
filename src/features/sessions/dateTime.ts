// Matches the value of <input type="datetime-local">: YYYY-MM-DDTHH:mm with optional seconds.
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const startsAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Interprets the value in the user's local time zone; returns null for malformed or
// non-existent dates (e.g. 2026-02-30T10:00).
export function parseLocalDateTime(localValue: string): Date | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(localValue);
  if (!match) {
    return null;
  }

  const [year, month, day, hours, minutes, seconds] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  const isExactMatch =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes;

  return isExactMatch ? date : null;
}

export function localInputToIso(localValue: string): string | null {
  return parseLocalDateTime(localValue)?.toISOString() ?? null;
}

export function formatStartsAt(iso: string): string {
  return startsAtFormatter.format(new Date(iso));
}
