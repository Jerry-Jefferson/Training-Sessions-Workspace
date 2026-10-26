// MOCK — no real backend; implements contract D2 (requirements §4.3).
import { delay, http, HttpResponse } from "msw";
import { z } from "zod";
import { titleSchema } from "../features/sessions/schemas";
import { addSession, getSessions } from "./db";

// The wire format carries an ISO instant, so only the title rules are shared with the form schema.
const createSessionRequestSchema = z.object({
  title: titleSchema,
  startsAt: z.iso.datetime().refine((value) => Date.parse(value) > Date.now()),
});

export const handlers = [
  http.get("/api/sessions", async () => {
    await delay();
    return HttpResponse.json(getSessions());
  }),

  http.post("/api/sessions", async ({ request }) => {
    await delay();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new HttpResponse(null, { status: 400 });
    }

    const result = createSessionRequestSchema.safeParse(body);
    if (!result.success) {
      return new HttpResponse(null, { status: 400 });
    }
    return HttpResponse.json(addSession(result.data), { status: 201 });
  }),
];
