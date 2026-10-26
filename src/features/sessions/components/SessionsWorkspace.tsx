import { useCallback, useState } from "react";
import "../sessions.css";
import type { Session } from "../schemas";
import type { StatusFilterValue } from "../types";
import { useSessions } from "../useSessions";
import { CreateSessionForm } from "./CreateSessionForm";
import { Modal } from "./Modal";
import { SessionList } from "./SessionList";
import { StatusFilter } from "./StatusFilter";

export function SessionsWorkspace() {
  const { status, sessions, retry, addSession } = useSessions();
  const [filter, setFilter] = useState<StatusFilterValue>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const closeCreate = useCallback(() => setIsCreateOpen(false), []);

  function handleCreated(session: Session) {
    addSession(session);
    // Reset a filter that would hide the new session (D3).
    setFilter((current) => (current === "all" || current === session.status ? current : "all"));
    setIsCreateOpen(false);
    setAnnouncement(`Session "${session.title}" created.`);
  }

  const visibleSessions =
    filter === "all" ? sessions : sessions.filter((session) => session.status === filter);

  return (
    <main className="workspace">
      <header className="workspace-header">
        <h1 className="workspace-title">Training sessions</h1>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setIsCreateOpen(true)}
        >
          Create session
        </button>
      </header>

      <p className="workspace-announcement" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className="workspace-toolbar">
        <StatusFilter value={filter} onChange={setFilter} disabled={status !== "success"} />
      </div>

      <section className="workspace-list" aria-label="Sessions">
        <SessionList
          status={status}
          sessions={visibleSessions}
          totalCount={sessions.length}
          filter={filter}
          onRetry={retry}
        />
      </section>

      {isCreateOpen ? (
        <Modal title="Create session" onClose={closeCreate} closeDisabled={isCreating}>
          <CreateSessionForm
            onCreated={handleCreated}
            onCancel={closeCreate}
            onPendingChange={setIsCreating}
          />
        </Modal>
      ) : null}
    </main>
  );
}
