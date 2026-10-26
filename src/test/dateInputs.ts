const DAY = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Formats a date as an <input type="datetime-local"> value in the local time zone.
export function toLocalInput(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function localInputDaysFromNow(days: number): string {
  return toLocalInput(new Date(Date.now() + days * DAY));
}
