import { useCallback, useEffect, useState } from "react";
import { fetchSessions } from "./api/sessionsApi";
import type { Session } from "./schemas";

export type SessionsStatus = "loading" | "error" | "success";

interface SessionsState {
  status: SessionsStatus;
  sessions: Session[];
}

const INITIAL_STATE: SessionsState = { status: "loading", sessions: [] };

// Server order wins; sessions added locally while a load was in flight are appended once.
function mergeLoaded(loaded: Session[], local: Session[]): Session[] {
  const loadedIds = new Set(loaded.map((session) => session.id));
  return [...loaded, ...local.filter((session) => !loadedIds.has(session.id))];
}

export function useSessions() {
  const [state, setState] = useState<SessionsState>(INITIAL_STATE);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchSessions(controller.signal).then(
      (loaded) => {
        setState((prev) => ({ status: "success", sessions: mergeLoaded(loaded, prev.sessions) }));
      },
      () => {
        if (controller.signal.aborted) {
          return;
        }
        setState((prev) => ({ ...prev, status: "error" }));
      }
    );

    return () => controller.abort();
  }, [loadCount]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading" }));
    setLoadCount((count) => count + 1);
  }, []);

  // Keeps the current status: after a failed initial load the error state stays (D4).
  const addSession = useCallback((session: Session) => {
    setState((prev) => ({ ...prev, sessions: [...prev.sessions, session] }));
  }, []);

  return { status: state.status, sessions: state.sessions, retry, addSession };
}
