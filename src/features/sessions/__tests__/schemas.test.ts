import { describe, expect, it } from "vitest";
import {
  createCreateSessionSchema,
  sessionSchema,
  STARTS_AT_NOT_FUTURE,
  STARTS_AT_REQUIRED,
  TITLE_REQUIRED,
  TITLE_TOO_LONG,
  TITLE_TOO_SHORT,
} from "../schemas";
import { getStatusLabel, SESSION_STATUS_LABELS } from "../types";

const KNOWN_MESSAGES = [
  TITLE_REQUIRED,
  TITLE_TOO_SHORT,
  TITLE_TOO_LONG,
  STARTS_AT_REQUIRED,
  STARTS_AT_NOT_FUTURE,
];

// Fixed local "now" built from components so the tests are time-zone independent.
const NOW = new Date(2030, 5, 15, 10, 0);
const MINUTE = 60_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalInput(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const FUTURE_INPUT = toLocalInput(new Date(NOW.getTime() + MINUTE));
const schema = createCreateSessionSchema(() => NOW);

function parse(values: { title?: unknown; startsAt?: unknown }) {
  return schema.safeParse({ title: "Valid title", startsAt: FUTURE_INPUT, ...values });
}

function fieldMessages(
  result: ReturnType<typeof parse>,
  field: "title" | "startsAt"
): string[] {
  if (result.success) {
    return [];
  }
  return result.error.issues.filter((issue) => issue.path[0] === field).map((i) => i.message);
}

describe("createSessionSchema — title", () => {
  it.each(["", "   "])("reports only the required message for %j", (title) => {
    expect(fieldMessages(parse({ title }), "title")).toEqual([TITLE_REQUIRED]);
  });

  it("reports the required message when the title is missing", () => {
    expect(fieldMessages(parse({ title: undefined }), "title")).toEqual([TITLE_REQUIRED]);
  });

  it.each(["ab", "  ab  "])("reports only the min-length message for %j", (title) => {
    expect(fieldMessages(parse({ title }), "title")).toEqual([TITLE_TOO_SHORT]);
  });

  it.each(["abc", "  abc  "])("accepts %j and outputs the trimmed value", (title) => {
    const result = parse({ title });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("abc");
  });

  it("accepts exactly 80 characters", () => {
    const title = "a".repeat(80);
    expect(parse({ title }).data?.title).toBe(title);
  });

  it("rejects 81 characters with only the max-length message", () => {
    expect(fieldMessages(parse({ title: "a".repeat(81) }), "title")).toEqual([TITLE_TOO_LONG]);
  });

  it("measures length after trimming surrounding whitespace", () => {
    const result = parse({ title: `  ${"a".repeat(80)}  ` });
    expect(result.success).toBe(true);
    expect(result.data?.title).toHaveLength(80);
  });

  it("preserves internal whitespace", () => {
    expect(parse({ title: "  a  b c  " }).data?.title).toBe("a  b c");
  });
});

describe("createSessionSchema — startsAt", () => {
  it.each(["", "not-a-date", "2030-02-30T10:00", undefined])(
    "reports only the required message for %j",
    (startsAt) => {
      expect(fieldMessages(parse({ startsAt }), "startsAt")).toEqual([STARTS_AT_REQUIRED]);
    }
  );

  it.each([
    ["equal to now", 0],
    ["one minute before now", -MINUTE],
  ])("rejects a value %s", (_label, offset) => {
    const startsAt = toLocalInput(new Date(NOW.getTime() + offset));
    expect(fieldMessages(parse({ startsAt }), "startsAt")).toEqual([STARTS_AT_NOT_FUTURE]);
  });

  it("accepts a value one minute after now", () => {
    expect(parse({ startsAt: FUTURE_INPUT }).success).toBe(true);
  });

  it("reads now on every parse, so a value that became past fails", () => {
    let now = NOW;
    const liveSchema = createCreateSessionSchema(() => now);
    const values = { title: "Valid title", startsAt: FUTURE_INPUT };

    expect(liveSchema.safeParse(values).success).toBe(true);

    now = new Date(NOW.getTime() + 2 * MINUTE);
    const result = liveSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(fieldMessages(result, "startsAt")).toEqual([STARTS_AT_NOT_FUTURE]);
  });

  it("outputs an ISO instant that maps back to the entered local date and time", () => {
    const entered = new Date(2031, 0, 2, 14, 30);
    const result = parse({ startsAt: toLocalInput(entered) });

    expect(result.success).toBe(true);
    const iso = result.data?.startsAt ?? "";
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(toLocalInput(new Date(iso))).toBe(toLocalInput(entered));
  });
});

describe("createSessionSchema — messages", () => {
  it("never surfaces zod default messages", () => {
    const cases = [
      {},
      { title: 42, startsAt: 42 },
      { title: "", startsAt: "" },
      { title: "ab", startsAt: "bad" },
      { title: "a".repeat(81), startsAt: toLocalInput(NOW) },
    ];

    for (const values of cases) {
      const result = schema.safeParse(values);
      expect(result.success).toBe(false);
      for (const issue of result.error?.issues ?? []) {
        expect(KNOWN_MESSAGES).toContain(issue.message);
      }
    }
  });
});

describe("sessionSchema", () => {
  const session = { id: "1", title: "Kickoff", status: "scheduled", startsAt: NOW.toISOString() };

  it("accepts an unknown status string", () => {
    expect(sessionSchema.safeParse({ ...session, status: "archived" }).success).toBe(true);
  });

  it("rejects a session without a title", () => {
    expect(sessionSchema.safeParse({ ...session, title: undefined }).success).toBe(false);
  });

  it("accepts ISO instants in UTC and with an offset", () => {
    expect(sessionSchema.safeParse(session).success).toBe(true);
    expect(
      sessionSchema.safeParse({ ...session, startsAt: "2030-06-15T10:00:00+02:00" }).success
    ).toBe(true);
  });

  it.each(["", "not-a-date", "2030-06-15T10:00"])("rejects the start date %j", (startsAt) => {
    expect(sessionSchema.safeParse({ ...session, startsAt }).success).toBe(false);
  });
});

describe("status labels", () => {
  it("labels the three known statuses", () => {
    expect(SESSION_STATUS_LABELS).toEqual({
      scheduled: "Scheduled",
      completed: "Completed",
      cancelled: "Cancelled",
    });
  });

  it("falls back to the raw value for unknown statuses", () => {
    expect(getStatusLabel("archived")).toBe("archived");
  });
});
