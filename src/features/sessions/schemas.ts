import { z } from "zod";
import { parseLocalDateTime } from "./dateTime";

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 80;

export const TITLE_REQUIRED = "Title is required.";
export const TITLE_TOO_SHORT = `Title must be at least ${TITLE_MIN_LENGTH} characters.`;
export const TITLE_TOO_LONG = `Title must be at most ${TITLE_MAX_LENGTH} characters.`;
export const STARTS_AT_REQUIRED = "Start date and time is required.";
export const STARTS_AT_NOT_FUTURE = "Start date and time must be in the future.";

// `status` stays a plain string so unknown statuses from the API are tolerated.
// `startsAt` must be a parseable instant: an invalid date would throw while rendering the list.
export const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
});

export const sessionListSchema = z.array(sessionSchema);

export type Session = z.output<typeof sessionSchema>;

// Checks are declared in display priority; aborting checks stop later ones from adding issues.
export const titleSchema = z
  .string({ error: TITLE_REQUIRED })
  .trim()
  .min(1, { error: TITLE_REQUIRED, abort: true })
  .min(TITLE_MIN_LENGTH, { error: TITLE_TOO_SHORT, abort: true })
  .max(TITLE_MAX_LENGTH, { error: TITLE_TOO_LONG });

// `getNow` is called on every parse so a value that became past is rejected on submit.
export function createCreateSessionSchema(getNow: () => Date = () => new Date()) {
  return z.object({
    title: titleSchema,
    startsAt: z.string({ error: STARTS_AT_REQUIRED }).transform((value, ctx) => {
      const startsAt = parseLocalDateTime(value);
      if (startsAt === null) {
        ctx.addIssue({ code: "custom", message: STARTS_AT_REQUIRED });
        return z.NEVER;
      }
      if (startsAt.getTime() <= getNow().getTime()) {
        ctx.addIssue({ code: "custom", message: STARTS_AT_NOT_FUTURE });
        return z.NEVER;
      }
      return startsAt.toISOString();
    }),
  });
}

export const createSessionSchema = createCreateSessionSchema();

export type CreateSessionFormValues = z.input<typeof createSessionSchema>;
export type CreateSessionInput = z.output<typeof createSessionSchema>;
