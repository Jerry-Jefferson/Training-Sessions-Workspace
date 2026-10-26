import { formatStartsAt } from "../dateTime";
import type { Session } from "../schemas";
import { getStatusLabel, SESSION_STATUS_LABELS, type StatusFilterValue } from "../types";
import type { SessionsStatus } from "../useSessions";

interface SessionListProps {
  status: SessionsStatus;
  // Sessions matching the filter, in API order.
  sessions: Session[];
  totalCount: number;
  filter: StatusFilterValue;
  onRetry: () => void;
}

export function SessionList({ status, sessions, totalCount, filter, onRetry }: SessionListProps) {
  if (status === "loading") {
    return (
      <p role="status" className="list-message">
        Loading sessions…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="list-message list-error">
        <p role="alert">We couldn't load your training sessions.</p>
        <button type="button" className="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (totalCount === 0) {
    return <p className="list-message">No training sessions yet.</p>;
  }

  if (sessions.length === 0 && filter !== "all") {
    return (
      <p className="list-message">No {SESSION_STATUS_LABELS[filter].toLowerCase()} sessions.</p>
    );
  }

  return (
    <ul className="session-list">
      {sessions.map((session) => (
        <li key={session.id} className="session-item">
          <p className="session-title">{session.title}</p>
          <span className="session-status" data-status={session.status}>
            {getStatusLabel(session.status)}
          </span>
          <time className="session-time" dateTime={session.startsAt}>
            {formatStartsAt(session.startsAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
