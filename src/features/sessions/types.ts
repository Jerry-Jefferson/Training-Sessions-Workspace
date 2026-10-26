export const SESSION_STATUSES = ["scheduled", "completed", "cancelled"] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type StatusFilterValue = "all" | SessionStatus;

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function isKnownStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

// Unknown statuses from the API are shown as their raw value.
export function getStatusLabel(status: string): string {
  return isKnownStatus(status) ? SESSION_STATUS_LABELS[status] : status;
}
