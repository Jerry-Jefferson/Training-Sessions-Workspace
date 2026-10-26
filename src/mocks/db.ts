// MOCK — in-memory sessions store for MSW handlers; no real backend or database.
import type { CreateSessionInput, Session } from "../features/sessions/schemas";
import type { SessionStatus } from "../features/sessions/types";

const DAY = 24 * 60 * 60 * 1000;

// Dates are relative to "now" so the seed always mixes past and upcoming sessions.
function seedSession(
  id: string,
  title: string,
  status: SessionStatus,
  daysFromNow: number,
  hour: number
): Session {
  const startsAt = new Date(Date.now() + daysFromNow * DAY);
  startsAt.setHours(hour, 0, 0, 0);
  return { id, title, status, startsAt: startsAt.toISOString() };
}

function createSeed(): Session[] {
  return [
    seedSession("seed-1", "Onboarding workshop", "completed", -14, 10),
    seedSession("seed-2", "React fundamentals", "completed", -7, 14),
    seedSession("seed-3", "Accessibility review", "cancelled", -2, 11),
    seedSession("seed-4", "Testing with Vitest", "scheduled", 3, 9),
    seedSession("seed-5", "Team retrospective", "cancelled", 5, 16),
    seedSession("seed-6", "Performance clinic", "scheduled", 10, 13),
  ];
}

let sessions: Session[] = createSeed();

export function getSessions(): Session[] {
  return [...sessions];
}

export function addSession(input: CreateSessionInput): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    title: input.title,
    status: "scheduled",
    startsAt: input.startsAt,
  };
  sessions = [...sessions, session];
  return session;
}

export function resetDb(): void {
  sessions = createSeed();
}
