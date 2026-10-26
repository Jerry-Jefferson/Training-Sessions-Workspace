import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import App from "../../../App";
import { server } from "../../../mocks/server";
import { localInputDaysFromNow } from "../../../test/dateInputs";
import { formatStartsAt } from "../dateTime";

const FUTURE = localInputDaysFromNow(7);
const LIST_ERROR = "We couldn't load your training sessions.";
const CREATE_ERROR = "Could not create the session. Please try again.";
const createdBodySchema = z.object({ title: z.string(), startsAt: z.string() });

function renderApp() {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  return user;
}

async function findSessionItems() {
  const list = await screen.findByRole("list");
  return within(list).getAllByRole("listitem");
}

function countRequests(method: string) {
  const counter = { count: 0 };
  server.events.on("request:start", ({ request }) => {
    if (request.method === method) {
      counter.count += 1;
    }
  });
  return counter;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: "Create session" }));
  const dialog = screen.getByRole("dialog", { name: "Create session" });
  await user.type(within(dialog).getByLabelText("Title"), title);
  await user.type(within(dialog).getByLabelText("Start date and time"), FUTURE);
  await user.click(within(dialog).getByRole("button", { name: "Save session" }));
  return dialog;
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe("SessionsWorkspace", () => {
  it("loads sessions, creates a new one and shows it in the list (core flow)", async () => {
    const user = renderApp();

    expect(screen.getByRole("heading", { name: "Training sessions" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading sessions…");
    expect(screen.getByLabelText("Status")).toBeDisabled();

    const items = await findSessionItems();
    expect(items).toHaveLength(6);
    const first = items[0];
    expect(first).toHaveTextContent("Onboarding workshop");
    expect(first).toHaveTextContent("Completed");
    const time = first.querySelector("time");
    expect(time).toHaveTextContent(formatStartsAt(time?.getAttribute("datetime") ?? ""));

    const createButton = screen.getByRole("button", { name: "Create session" });
    const dialog = await fillAndSubmit(user, "  Team kickoff  ");

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const updated = await findSessionItems();
    expect(updated).toHaveLength(7);
    expect(updated[6]).toHaveTextContent("Team kickoff");
    expect(updated[6]).toHaveTextContent("Scheduled");
    expect(screen.getByText('Session "Team kickoff" created.')).toBeInTheDocument();
    expect(createButton).toHaveFocus();
  });

  it("filters by status without new requests and shows a filtered-empty message", async () => {
    const user = renderApp();
    await findSessionItems();
    const gets = countRequests("GET");
    const filter = screen.getByLabelText("Status");

    await user.selectOptions(filter, "completed");
    let items = await findSessionItems();
    expect(items).toHaveLength(2);
    items.forEach((item) => expect(item).toHaveTextContent("Completed"));
    expect(filter).toHaveValue("completed");

    await user.selectOptions(filter, "all");
    items = await findSessionItems();
    expect(items).toHaveLength(6);
    expect(gets.count).toBe(0);
  });

  it("shows the filtered-empty message when no session has the selected status", async () => {
    server.use(
      http.get("/api/sessions", () =>
        HttpResponse.json([
          {
            id: "1",
            title: "Only scheduled",
            status: "scheduled",
            startsAt: new Date().toISOString(),
          },
        ])
      )
    );
    const user = renderApp();
    await findSessionItems();

    await user.selectOptions(screen.getByLabelText("Status"), "cancelled");

    expect(screen.getByText("No cancelled sessions.")).toBeInTheDocument();
    expect(screen.queryByText("No training sessions yet.")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no sessions", async () => {
    server.use(http.get("/api/sessions", () => HttpResponse.json([])));
    renderApp();

    expect(await screen.findByText("No training sessions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create session" })).toBeEnabled();
  });

  it("shows an error with Retry and recovers on a successful retry", async () => {
    server.use(
      http.get("/api/sessions", () => new HttpResponse(null, { status: 500 }), { once: true })
    );
    const user = renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(LIST_ERROR);
    expect(screen.getByRole("heading", { name: "Training sessions" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(document.body).not.toHaveTextContent("500");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading sessions…");
    expect(await findSessionItems()).toHaveLength(6);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the list error instead of crashing when a session has an invalid start date", async () => {
    server.use(
      http.get(
        "/api/sessions",
        () =>
          HttpResponse.json([
            { id: "1", title: "Broken date", status: "scheduled", startsAt: "not-a-date" },
          ]),
        { once: true }
      )
    );
    const user = renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(LIST_ERROR);
    expect(screen.getByRole("heading", { name: "Training sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create session" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await findSessionItems()).toHaveLength(6);
  });

  it("keeps the modal open with values preserved when creation fails", async () => {
    server.use(http.post("/api/sessions", () => new HttpResponse(null, { status: 500 })));
    const user = renderApp();
    await findSessionItems();

    const dialog = await fillAndSubmit(user, "  Team kickoff  ");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(CREATE_ERROR);
    const title = within(dialog).getByLabelText("Title");
    const startsAt = within(dialog).getByLabelText("Start date and time");
    expect(title).toHaveValue("  Team kickoff  ");
    expect(startsAt).toHaveValue(FUTURE);
    expect(title).not.toHaveAttribute("aria-invalid");
    expect(startsAt).not.toHaveAttribute("aria-invalid");
    expect(within(dialog).getByRole("button", { name: "Save session" })).toBeEnabled();
    expect(await findSessionItems()).toHaveLength(6);
  });

  it("resets the filter to All when it would hide the created session", async () => {
    const user = renderApp();
    await findSessionItems();
    await user.selectOptions(screen.getByLabelText("Status"), "completed");

    const dialog = await fillAndSubmit(user, "Team kickoff");

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByLabelText("Status")).toHaveValue("all");
    expect(screen.getByText("Team kickoff")).toBeInTheDocument();
  });

  it("keeps the list error after create and shows the session once after Retry", async () => {
    server.use(
      http.get("/api/sessions", () => new HttpResponse(null, { status: 500 }), { once: true })
    );
    const user = renderApp();
    await screen.findByRole("alert");

    const dialog = await fillAndSubmit(user, "Team kickoff");

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(LIST_ERROR);
    expect(screen.getByText('Session "Team kickoff" created.')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    const items = await findSessionItems();
    expect(items.filter((item) => item.textContent?.includes("Team kickoff"))).toHaveLength(1);
  });

  it("traps focus, closes on Escape, restores focus and reopens with a clean form", async () => {
    const user = renderApp();
    await findSessionItems();
    const createButton = screen.getByRole("button", { name: "Create session" });

    await user.click(createButton);
    const dialog = screen.getByRole("dialog", { name: "Create session" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const title = within(dialog).getByLabelText("Title");
    expect(title).toHaveFocus();

    await user.type(title, "ab");
    await user.tab();
    expect(await within(dialog).findByText("Title must be at least 3 characters.")).toBeVisible();

    await user.tab();
    await user.tab();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Save session" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(dialog).not.toBeInTheDocument();
    expect(createButton).toHaveFocus();

    await user.click(createButton);
    const reopened = screen.getByRole("dialog", { name: "Create session" });
    expect(within(reopened).getByLabelText("Title")).toHaveValue("");
    expect(within(reopened).queryByText("Title must be at least 3 characters.")).toBeNull();
  });

  it("ignores Escape while the create request is pending", async () => {
    server.use(
      http.post("/api/sessions", async ({ request }) => {
        const body = createdBodySchema.parse(await request.json());
        await delay(200);
        return HttpResponse.json(
          { id: "created-1", status: "scheduled", ...body },
          { status: 201 }
        );
      })
    );
    const user = renderApp();
    await findSessionItems();

    const dialog = await fillAndSubmit(user, "Team kickoff");
    await within(dialog).findByRole("button", { name: "Creating…" });
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
