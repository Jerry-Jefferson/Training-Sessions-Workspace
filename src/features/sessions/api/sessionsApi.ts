import type { z } from "zod";
import {
  sessionListSchema,
  sessionSchema,
  type CreateSessionInput,
  type Session,
} from "../schemas";

const SESSIONS_PATH = "/api/sessions";

// Generic failure for non-2xx responses, network errors, invalid JSON and unexpected payloads.
// Details stay in `cause` for debugging and never reach UI copy. Aborts are re-thrown untouched.
export class SessionsRequestError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.name = "SessionsRequestError";
    this.status = status;
  }
}

// Checked by name: the DOMException class differs between realms (e.g. jsdom vs Node fetch).
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// Absolute URL: Node's fetch under Vitest rejects relative URLs.
function sessionsUrl(): string {
  return new URL(SESSIONS_PATH, window.location.origin).toString();
}

async function request<T>(schema: z.ZodType<T>, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(sessionsUrl(), init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new SessionsRequestError("Network request failed", null, { cause: error });
  }

  if (!response.ok) {
    throw new SessionsRequestError(
      `Request failed with status ${response.status}`,
      response.status
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new SessionsRequestError("Response is not valid JSON", response.status, { cause: error });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new SessionsRequestError("Unexpected response shape", response.status, {
      cause: result.error,
    });
  }
  return result.data;
}

export function fetchSessions(signal?: AbortSignal): Promise<Session[]> {
  return request(sessionListSchema, { method: "GET", signal });
}

export function createSession(input: CreateSessionInput): Promise<Session> {
  return request(sessionSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, startsAt: input.startsAt }),
  });
}
