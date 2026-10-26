import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../mocks/server";
import { localInputDaysFromNow, toLocalInput } from "../../../test/dateInputs";
import { CreateSessionForm } from "../components/CreateSessionForm";
import {
  STARTS_AT_NOT_FUTURE,
  STARTS_AT_REQUIRED,
  TITLE_REQUIRED,
  TITLE_TOO_SHORT,
} from "../schemas";

const FUTURE = localInputDaysFromNow(7);
const PAST = localInputDaysFromNow(-1);

function renderForm() {
  const props = { onCreated: vi.fn(), onCancel: vi.fn(), onPendingChange: vi.fn() };
  const user = userEvent.setup();
  render(<CreateSessionForm {...props} />);
  return {
    ...props,
    user,
    title: screen.getByLabelText("Title"),
    startsAt: screen.getByLabelText("Start date and time"),
    submit: screen.getByRole("button", { name: "Save session" }),
  };
}

function countPosts() {
  const requests: Request[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method === "POST") {
      requests.push(request.clone());
    }
  });
  return requests;
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe("CreateSessionForm", () => {
  it("validates the title only after blur, then on every change", async () => {
    const { user, title } = renderForm();

    await user.type(title, "ab");
    expect(screen.queryByText(TITLE_TOO_SHORT)).not.toBeInTheDocument();

    await user.tab();
    expect(await screen.findByText(TITLE_TOO_SHORT)).toBeInTheDocument();

    await user.click(title);
    await user.type(title, "c");
    await waitFor(() => expect(screen.queryByText(TITLE_TOO_SHORT)).not.toBeInTheDocument());
    expect(title).not.toHaveAttribute("aria-invalid");
  });

  it("blocks an invalid submit with exact messages and focuses the first field", async () => {
    const posts = countPosts();
    const { user, title, startsAt, submit, onCreated } = renderForm();

    await user.type(title, "   ");
    await user.type(startsAt, PAST);
    await user.click(submit);

    expect(await screen.findByText(TITLE_REQUIRED)).toBeInTheDocument();
    expect(screen.getByText(STARTS_AT_NOT_FUTURE)).toBeInTheDocument();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription(TITLE_REQUIRED);
    expect(startsAt).toHaveAttribute("aria-invalid", "true");
    expect(startsAt).toHaveAccessibleDescription(STARTS_AT_NOT_FUTURE);
    expect(title).toHaveFocus();
    expect(posts).toHaveLength(0);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the required date message and never zod default text", async () => {
    const { user, title, submit } = renderForm();

    await user.type(title, "Valid title");
    await user.click(submit);

    expect(await screen.findByText(STARTS_AT_REQUIRED)).toBeInTheDocument();
    expect(screen.queryByText(STARTS_AT_NOT_FUTURE)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Invalid input|Expected/);
  });

  it("sends one request on double click + Enter and locks the form while pending", async () => {
    const posts = countPosts();
    server.use(
      http.post("/api/sessions", async ({ request }) => {
        const body = (await request.json()) as { title: string; startsAt: string };
        await delay(200);
        return HttpResponse.json(
          { id: "created-1", status: "scheduled", ...body },
          { status: 201 }
        );
      })
    );
    const { user, title, startsAt, submit, onCreated, onCancel, onPendingChange } = renderForm();

    await user.type(title, "Team kickoff");
    await user.type(startsAt, FUTURE);
    await user.dblClick(submit);
    await user.keyboard("{Enter}");

    const pending = await screen.findByRole("button", { name: "Creating…" });
    expect(pending).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(title).toHaveAttribute("readonly");
    expect(startsAt).toHaveAttribute("readonly");
    expect(onPendingChange).toHaveBeenLastCalledWith(true);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  // Two submits in the same tick, before React can re-render the disabled button.
  it("sends one request when the form is submitted twice synchronously", async () => {
    const posts = countPosts();
    const { user, title, startsAt, submit, onCreated } = renderForm();

    await user.type(title, "Team kickoff");
    await user.type(startsAt, FUTURE);
    const form = submit.closest("form");
    if (!form) {
      throw new Error("form not found");
    }
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
  });

  it("submits the trimmed title and an ISO start instant", async () => {
    const posts = countPosts();
    const { user, title, startsAt, submit, onCreated } = renderForm();
    const entered = localInputDaysFromNow(3);

    await user.type(title, "  Team   kickoff  ");
    await user.type(startsAt, entered);
    await user.click(submit);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
    const body = (await posts[0].json()) as { title: string; startsAt: string };
    expect(body.title).toBe("Team   kickoff");
    expect(body.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(toLocalInput(new Date(body.startsAt))).toBe(entered);
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Team   kickoff", status: "scheduled" })
    );
  });

  it("calls onCancel from the Cancel button", async () => {
    const { user, onCancel } = renderForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
