import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../mocks/server";
import { createSession, fetchSessions, SessionsRequestError } from "../api/sessionsApi";
import { SESSION_STATUSES } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const futureIso = () => new Date(Date.now() + DAY).toISOString();

describe("fetchSessions", () => {
  it("returns the mocked sessions covering every status", async () => {
    const sessions = await fetchSessions();

    expect(sessions.length).toBeGreaterThan(0);
    expect(new Set(sessions.map((session) => session.status))).toEqual(new Set(SESSION_STATUSES));
  });

  it("rejects with SessionsRequestError on a non-2xx response", async () => {
    server.use(http.get("/api/sessions", () => new HttpResponse(null, { status: 500 })));

    await expect(fetchSessions()).rejects.toMatchObject({
      name: "SessionsRequestError",
      status: 500,
    });
  });

  it("rejects with SessionsRequestError on a network failure", async () => {
    server.use(http.get("/api/sessions", () => HttpResponse.error()));

    await expect(fetchSessions()).rejects.toBeInstanceOf(SessionsRequestError);
  });

  it("rejects with SessionsRequestError on an unexpected payload", async () => {
    server.use(http.get("/api/sessions", () => HttpResponse.json([{ id: "1" }])));

    await expect(fetchSessions()).rejects.toBeInstanceOf(SessionsRequestError);
  });

  it("re-throws aborts untouched", async () => {
    const controller = new AbortController();
    const promise = fetchSessions(controller.signal);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await expect(promise).rejects.not.toBeInstanceOf(SessionsRequestError);
  });
});

describe("createSession", () => {
  it("creates a scheduled session that is appended to the list", async () => {
    const startsAt = futureIso();
    const created = await createSession({ title: "Team kickoff", startsAt });

    expect(created).toMatchObject({ title: "Team kickoff", status: "scheduled", startsAt });
    const sessions = await fetchSessions();
    expect(sessions.at(-1)).toEqual(created);
  });

  it("gives every created session a unique id", async () => {
    const first = await createSession({ title: "First", startsAt: futureIso() });
    const second = await createSession({ title: "Second", startsAt: futureIso() });

    expect(first.id).not.toBe(second.id);
  });

  it.each([
    ["a 2-character title", { title: "ab", startsAt: futureIso() }],
    ["an 81-character title", { title: "a".repeat(81), startsAt: futureIso() }],
    ["a past start", { title: "Valid title", startsAt: new Date(Date.now() - DAY).toISOString() }],
  ])("is rejected by the mock with 400 for %s", async (_label, input) => {
    await expect(createSession(input)).rejects.toMatchObject({
      name: "SessionsRequestError",
      status: 400,
    });
  });
});
