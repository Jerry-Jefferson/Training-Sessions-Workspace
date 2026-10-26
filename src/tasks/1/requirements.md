# TASK-1: Trainer Workspace & Training Sessions Management

Source: `training_sessions_ideas.md` (repository root)
Status: Requirements confirmed — open questions OQ-1…OQ-7 resolved by developer (see §13); tech stack extended with zod + react-hook-form (D8); ready for (re-)planning (see [Readiness](#readiness))
Last updated: 2026-10-23 (rev. 4 — requirements aligned with zod + react-hook-form throughout: scope, mock, validation, form states, constraints, tests, non-goals)

---

## 1. Goal

Deliver a single frontend workspace in which a trainer can view training sessions loaded asynchronously from a mocked API, filter them by status, open a create form, submit a valid new session, and immediately see that session in the visible list — with explicit loading, empty, error and pending states, and with all remote data access behind a replaceable request boundary.

## 2. Users And Outcome

| Item | Description |
| --- | --- |
| Primary user | A trainer managing their own training sessions. |
| Problem | The trainer needs one place to see upcoming/past sessions, narrow them by status, and schedule a new session without leaving the workspace. |
| Desired outcome | The trainer completes the flow **list → filter → create → see new session** without page reloads, without ambiguous states, and without being able to submit invalid or duplicate sessions. |
| Authentication / roles | None. The workspace is accessible to anyone who opens the app; no permission states apply (see Non-Goals). |

## 3. Scope Summary

In scope (and only these):

1. Workspace view that loads and displays sessions from a mock API.
2. One status filter control with an **All** option.
3. A create-session form presented in a **modal dialog** (decision D5).
4. Create submission with client-side validation (a **zod** schema driving a **react-hook-form** form — D8) and pending-state duplicate-submit prevention.
5. Newly created session shown in the visible list on success.
6. Mocked HTTP boundary using MSW (no real backend).
7. At least one automated behavior-level test of the core flow.

---

## 4. Domain Model And API Contract (Confirmed by developer)

> **Confirmed for this task.** The developer confirmed the status values (D1) and the API surface in §4.3 (D2) as the contract to implement. No real backend exists; the contract is served by MSW mocks. Mock code remains labelled as mock (TC-9).

### 4.1 Training Session

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique, assigned by the (mock) server on creation. Never entered by the user. |
| `title` | string | yes | Stored trimmed; 3–80 characters. |
| `status` | `SessionStatus` | yes | Assigned by the server; not user-selectable in the create form. |
| `startsAt` | string (ISO 8601 date-time with offset, e.g. UTC `Z`) | yes | Absolute instant; displayed in the user's local time zone. |

### 4.2 SessionStatus (confirmed values — D1)

| Value | Display label | Meaning |
| --- | --- | --- |
| `scheduled` | Scheduled | Session is planned for the future. |
| `completed` | Completed | Session has taken place. |
| `cancelled` | Cancelled | Session will not take place. |

- A newly created session receives status `scheduled` (assumption A2).
- The UI must render the label for each known status. Behavior for an unknown status value from the API: see the note at the end of §6.2.

### 4.3 API Surface (confirmed — D2; mocked via MSW)

| Operation | Method & path | Request | Success response | Failure response |
| --- | --- | --- | --- | --- |
| List sessions | `GET /api/sessions` | — | `200` + `Session[]` | Any non-2xx or network failure → list error state |
| Create session | `POST /api/sessions` | `{ title: string, startsAt: string }` | `201` + created `Session` | Any non-2xx or network failure → create error state |

- Error shape: no error body is defined; any non-2xx status or network failure is treated as a generic failure. The client must not depend on error-body fields.
- Filtering is applied client-side to the loaded list (assumption A4); no query parameters are required.
- The mock holds sessions in memory; created sessions persist only until the mock is reset (page reload / test reset). This is acceptable for this task.
- The mock `POST` handler validates the request body against the **same zod create-session rules** as the form (§6) and responds `400` when they fail. The UI never depends on this response for field errors (§6 intro); it is treated as a generic create failure (AC-4.5). The mock may import the shared schema; UI code must never import from the mock (TC-4).
- The mock should be able to simulate: successful list (non-empty), empty list, list failure, successful create, create failure, and response latency (so loading/pending states are observable). How these scenarios are toggled is an implementation/test concern.

---

## 5. User Stories And Acceptance Criteria

### US-1 — View training sessions

**As a** trainer, **I want** to see my training sessions when I open the workspace, **so that** I know what is planned and what has happened.

| ID | Acceptance criterion |
| --- | --- |
| AC-1.1 | **Given** I open the workspace, **when** the sessions request is in progress, **then** a clear loading state is shown in the list area and no session rows, empty message or error message are shown. |
| AC-1.2 | **Given** the sessions request succeeds with one or more sessions, **when** loading completes, **then** each session is shown with its **title**, **status label** and **start date and time**. |
| AC-1.3 | **Given** a session's `startsAt` is an ISO instant, **when** it is displayed, **then** it is shown in the user's local time zone and includes both date and time (locale-aware formatting). |
| AC-1.4 | **Given** the sessions request succeeds with zero sessions, **when** loading completes, **then** an empty state explains that there are no sessions yet. The create action remains available. |
| AC-1.5 | **Given** the sessions request fails (non-2xx or network error), **when** loading completes, **then** an understandable error message is shown (no raw status codes, stack traces or payloads) together with a **Retry** action. |
| AC-1.6 | **Given** the list error state is shown, **when** I activate **Retry**, **then** the loading state is shown again and the request is re-issued; on success the list (or empty state) replaces the error. |
| AC-1.7 | **Given** the list is loading or in error, **then** the workspace shell (heading and surrounding layout) remains rendered and usable; the failure is contained to the list area. |
| AC-1.8 | **Given** sessions are displayed, **then** they appear in the order returned by the API, with newly created sessions appended at the end. No client-side sorting is applied (decision D6). |

### US-2 — Filter sessions by status

**As a** trainer, **I want** to filter sessions by status, **so that** I can focus on the sessions relevant to me right now.

| ID | Acceptance criterion |
| --- | --- |
| AC-2.1 | **Given** the workspace has loaded, **then** exactly **one** status filter control is present, offering **All** plus one option per status (Scheduled, Completed, Cancelled). |
| AC-2.2 | **Given** I open the workspace, **then** the filter defaults to **All** and all loaded sessions are shown. |
| AC-2.3 | **Given** sessions with mixed statuses are loaded, **when** I select a status, **then** only sessions with that status are shown, without a new network request and without a full-page reload. |
| AC-2.4 | **Given** a status filter is active, **when** I select **All**, **then** all loaded sessions are shown again (reset). |
| AC-2.5 | **Given** a status filter is active and no loaded session has that status, **then** a filtered-empty message is shown that names the selected status (e.g. "No cancelled sessions") and is distinguishable from the "no sessions yet" empty state. |
| AC-2.6 | **Given** the list is loading or in error, **then** the filter control is either disabled or has no effect until data is available; changing it must never trigger an error or blank screen. |
| AC-2.7 | **Given** I change the filter, **then** the currently selected option is visually and programmatically indicated (e.g. selected value of a native select, `aria-pressed`/`aria-checked` for button groups). |

### US-3 — Open the create session form

**As a** trainer, **I want** to open a form for a new session, **so that** I can enter its details.

| ID | Acceptance criterion |
| --- | --- |
| AC-3.1 | **Given** the workspace is shown (in any list state: loading, loaded, empty or error), **then** a clearly labelled "Create session" (or equivalent) action is available. |
| AC-3.2 | **Given** I activate the create action, **then** a **modal dialog** opens (decision D5) containing a form with a **Title** field, a **Start date and time** field, a submit action and a cancel/close action. |
| AC-3.3 | **Given** the modal opens, **then** it is exposed as a dialog with an accessible name (e.g. "Create session"), keyboard focus moves to the first field, focus is contained within the modal while it is open, and both fields have visible, programmatically associated labels. |
| AC-3.4 | **Given** the modal is open and no request is pending, **when** I activate cancel/close or press **Escape**, **then** the modal closes, entered values and validation errors are discarded, and focus returns to the create action. |
| AC-3.5 | **Given** I reopen the modal after closing it or after a successful creation, **then** the form starts empty with no validation errors shown and with no touched/submitted state carried over (react-hook-form state is fully reset). |
| AC-3.6 | **Given** the modal is open, **then** the content behind it is not interactive (background inert / not reachable by keyboard or pointer). |

### US-4 — Create a session with valid data

**As a** trainer, **I want** to submit a new session with a valid title and future date/time, **so that** it is scheduled.

| ID | Acceptance criterion |
| --- | --- |
| AC-4.1 | **Given** a valid title and future date/time, **when** I submit, **then** exactly one create request is sent containing the **trimmed** title and the start instant as an ISO 8601 string. |
| AC-4.2 | **Given** a create request is pending, **then** the submit action is disabled and indicates progress (e.g. label "Creating…"); repeated clicks or pressing **Enter** do not send additional requests. |
| AC-4.3 | **Given** a create request is pending, **then** form fields are read-only/disabled and the modal cannot be closed (cancel, close and Escape are inactive) until the request settles (assumption A7). |
| AC-4.4 | **Given** the create request succeeds, **then** the modal closes, focus returns to the create action, and a brief success confirmation is announced (visible text plus a polite live-region announcement). |
| AC-4.5 | **Given** the create request fails, **then** the modal stays open, entered values are preserved, an understandable form-level error is shown (e.g. "Could not create the session. Please try again."), and the submit action is re-enabled so I can retry. |
| AC-4.6 | **Given** the create request fails, **then** the sessions list is unchanged (no optimistic row remains). |

### US-5 — See the newly created session

**As a** trainer, **I want** to see the session I just created, **so that** I can trust it was saved.

| ID | Acceptance criterion |
| --- | --- |
| AC-5.1 | **Given** the create request succeeds, **then** the session returned by the server (title, status, start date/time) appears in the visible list immediately, without a page reload and without requiring a manual refresh. |
| AC-5.2 | **Given** the filter is **All** or matches the new session's status, **when** creation succeeds, **then** the filter remains unchanged and the new session is visible. |
| AC-5.3 | **Given** the active filter would hide the new session (e.g. filter = Completed, new session = Scheduled), **when** creation succeeds, **then** the filter resets to **All** so the new session is visible (decision D3). |
| AC-5.4 | **Given** the list was in the empty state, **when** creation succeeds, **then** the empty state is replaced by the list containing the new session. |
| AC-5.5 | **Given** the list was in the error state (initial load failed), **when** creation succeeds, **then** the list is **not** refetched automatically, the list error state remains with Retry available, and the success confirmation is still shown (decision D4). After a later successful Retry, the list reflects the server data, which includes the created session exactly once. |
| AC-5.6 | **Given** the session was created, **then** it appears exactly once in the list (no duplicates from both a local append and a refetch). |

---

## 6. Validation Rules

Validation runs on the client. The mock server mirrors these rules (§4.3), but the client must never rely on a server round-trip to show field errors.

**Single source of truth (D8, TC-11):** all field rules below (VR-T1…VR-T5, VR-D1…VR-D3, VR-D5) are defined once in a **zod** create-session schema and applied to the form through **react-hook-form** (via the zod resolver, A12). No field rule may be duplicated in hand-written component logic or in native HTML constraint attributes that would block or pre-empt the schema (e.g. `required`, `minLength`, `maxLength`, `min` on the inputs); the form disables native browser validation so browser bubbles never replace the messages below.

**Message ownership:** every message the user can see for a field is one of the exact strings in §6.1–§6.2. zod's built-in/default messages (e.g. "Invalid input", "Expected string, received …", "Too small: expected string to have >=3 characters") must never be shown — including for empty or unparseable date input.

### 6.1 Title

| ID | Rule | Error message (proposed copy) |
| --- | --- | --- |
| VR-T1 | Required: the value after trimming leading/trailing whitespace must not be empty. A whitespace-only value counts as empty. | "Title is required." |
| VR-T2 | Minimum length: trimmed value must be **≥ 3** characters. | "Title must be at least 3 characters." |
| VR-T3 | Maximum length: trimmed value must be **≤ 80** characters. | "Title must be at most 80 characters." |
| VR-T4 | Trimming: only leading/trailing whitespace is removed; internal whitespace is preserved as typed. The trimmed value is what is validated and sent (the schema's parsed output). The input itself keeps showing exactly what the user typed while editing — trimming must not rewrite the field's visible value or move the caret. | — |
| VR-T5 | Length is measured on the trimmed string (assumption A9: JavaScript string length; no special grapheme handling required). | — |
| VR-T6 | Input of more than 80 characters must not be silently truncated in a way that hides the problem; either allow typing and show VR-T3, or constrain input with a visible character limit. Choice owned by `ui-designer` (non-blocking). | — |

Boundary examples:

| Input (quotes delimit) | Trimmed length | Valid? |
| --- | --- | --- |
| `""` / `"   "` | 0 | No — VR-T1 |
| `"ab"` / `"  ab  "` | 2 | No — VR-T2 |
| `"abc"` / `"  abc  "` | 3 | Yes (sent as `"abc"`) |
| 80 characters | 80 | Yes |
| 81 characters | 81 | No — VR-T3 |
| 80 characters + surrounding spaces | 80 | Yes (spaces removed) |

### 6.2 Start Date And Time

| ID | Rule | Error message (proposed copy) |
| --- | --- | --- |
| VR-D1 | Required: both a date and a time must be provided and must form a valid date-time. | "Start date and time is required." |
| VR-D2 | Must be strictly in the future: the entered instant (interpreted in the user's local time zone) must be **later than** the current time **at the moment of submission**. A value equal to now, or in the past, is invalid. | "Start date and time must be in the future." |
| VR-D3 | A value that was in the future when entered but has become past by the time of submit must fail VR-D2 on submit (re-check at submit time). | Same as VR-D2 |
| VR-D4 | The submitted value is converted to an absolute ISO 8601 instant; the displayed value in the list must correspond to the same local date/time the user entered. | — |
| VR-D5 | "Now" is read each time the schema validates (blur, change after an error is shown, submit), never captured once when the schema module loads or when the modal opens. Tests must be able to control "now" (TR-3). | — |

Unknown status from API: if a loaded session has a status outside the known set, it is shown under **All** with the raw value as a fallback label and is never matched by a specific status filter; it must not crash rendering.

### 6.3 Validation Timing And Presentation

| ID | Rule |
| --- | --- |
| VR-P1 | On submit, all fields are validated; if any is invalid, **no request is sent** (the submit handler is not invoked), each invalid field shows its message, and focus moves to the first invalid field in visual order (Title before Start date and time). |
| VR-P2 | Before the first submit attempt, an error for a field may be shown after the user leaves it (blur) — not on every keystroke of a pristine field. |
| VR-P3 | Once a field's error is shown, it is re-evaluated as the user edits and clears as soon as the value becomes valid. |
| VR-P4 | Each field error is displayed inline next to its field, is associated with the input (e.g. `aria-describedby`), and the input is marked invalid (`aria-invalid="true"`). |
| VR-P5 | Only one message per field is shown at a time, in priority order: required → min length → max length (title); required → future (date/time). Although zod can report several issues per field, the displayed message must follow this priority — e.g. a whitespace-only title shows "Title is required.", not the min-length message; an empty date shows the required message, not the future message. |
| VR-P6 | The submit button is **not** disabled because of validation errors (only while pending), so users can always trigger VR-P1 feedback. (Assumption A10.) |
| VR-P7 | Server-side create failures are shown as a form-level error, distinct from field errors. A server failure must not mark either field as invalid, and the form-level error clears when the user submits again. |

> **Informative mapping (non-binding, for planning):** VR-P2/VR-P3 correspond to react-hook-form's "validate on first blur, then on every change" behavior (`onTouched`-style), with re-validation on change after a submit attempt; VR-P1 corresponds to its built-in focus-on-first-error; VR-P7 corresponds to a root/form-level error rather than a field error. The exact configuration is a `writing-plans` decision (§14); only the behavior above is binding.

---

## 7. UI States

### 7.1 Sessions List Area

| State | Trigger | What the user sees | Available actions |
| --- | --- | --- | --- |
| Loading | Initial load or Retry in progress | Loading indicator with accessible text (e.g. "Loading sessions…"), announced politely | Create action; filter disabled/inert |
| Loaded | Request succeeded, ≥1 session matches filter | List of sessions (title, status label, start date/time) | Filter, Create |
| Empty | Request succeeded, 0 sessions total | "No training sessions yet" message | Create; filter shown but inert or hidden (UI designer decision) |
| Filtered empty | Request succeeded, ≥1 session total, 0 match the selected status | "No <status> sessions" message, distinct from Empty | Filter (incl. All), Create |
| Error | Request failed (non-2xx / network) | Human-readable error message (announced, e.g. `role="alert"`) | Retry, Create |

### 7.2 Create Form

| State | Trigger | What the user sees | Available actions |
| --- | --- | --- | --- |
| Closed | Default / after cancel / after success | Create action only | Open modal |
| Idle (open) | Modal opened | Empty Title and Start date/time fields, no errors | Fill, Submit, Cancel |
| Invalid | zod schema failed on blur, on change after an error was shown, or on submit | Inline field errors per §6 (exact §6 copy only) | Edit, Submit, Cancel |
| Pending | Schema passed; create request in flight (react-hook-form submitting state) | Submit disabled with progress label; fields disabled/read-only; no new validation errors appear while pending | None (wait) |
| Submit error | Create request failed | Form-level error; values preserved exactly as typed; fields not marked invalid | Edit, Submit (retry), Cancel |
| Success | Create request succeeded | Modal closes; form state (values, errors, touched, submitted) discarded; success confirmation; new session in list (filter reset to All if needed) | Open modal again |

### 7.3 Cross-Cutting UI Requirements

| ID | Requirement |
| --- | --- |
| UI-1 | **Accessibility:** all controls are keyboard operable with visible focus; loading, success and error messages are exposed via live regions; status is conveyed by text, not colour alone; semantic list markup for sessions; meets WCAG 2.2 AA contrast using existing CSS tokens in `src/index.css`. |
| UI-2 | **Responsive:** the full flow is usable from 320 px width up to desktop without horizontal scrolling; the create modal fits small viewports (content scrollable within the modal if needed). |
| UI-3 | **Theming:** respects the existing light/dark `prefers-color-scheme` tokens already defined in `src/index.css`. |
| UI-4 | **Localization:** UI copy is English only. Dates/times use locale-aware formatting of the user's environment. Full i18n is out of scope. |
| UI-5 | **Error copy:** never expose raw HTTP status codes, response bodies or stack traces to the user. |

---

## 8. Technical Constraints

### 8.1 Tech Stack

| Concern | Tool | Status in repo | Use in this task |
| --- | --- | --- | --- |
| UI framework | React 19 (`react`, `react-dom`) | Installed | All UI |
| Language | TypeScript ~6.0 (strict unused checks, `verbatimModuleSyntax`, `erasableSyntaxOnly`) | Installed | All code |
| Build / dev server | Vite 8 + `@vitejs/plugin-react` | Installed | Dev + build |
| Package manager | npm (`package-lock.json`) | In use | Install D8 packages |
| Forms | **react-hook-form** | **To be added** (D8) | Create-session form state, touched/submitted tracking, submit handling |
| Validation | **zod** (v4, A14) | **To be added as a direct dependency** (D8; v4.6.7 present only transitively) | Create-session schema (single source of truth for §6); optional response parsing (TC-14) |
| Form ↔ schema bridge | **@hookform/resolvers** (zod resolver) | **To be added** (D8, A12) | Connect the schema to the form |
| API mocking | MSW 3 | Installed (dev) | Dev worker + test server |
| Tests | Vitest 5, jsdom, Testing Library (`react`, `user-event`, `jest-dom`) | Installed (dev) | Unit + behavior tests |
| Lint | ESLint 10 + typescript-eslint, react-hooks, react-refresh, eslint-config-prettier | Installed (dev) | `npm run lint` |

### 8.2 Constraints

| ID | Constraint (from repository facts and decisions) |
| --- | --- |
| TC-1 | Use the stack in §8.1 only: React 19 + TypeScript (~6.0) + Vite 8, npm, extended by D8 (zod, react-hook-form, @hookform/resolvers). Do not introduce another framework or package manager. |
| TC-2 | Tests use the existing Vitest 5 + jsdom + Testing Library (`@testing-library/react`, `user-event`, `jest-dom`) setup in `vite.config.ts` and `src/test/setup.ts`. Run via `npm test`. |
| TC-3 | Mocking uses **MSW** (`msw` ^3 is already a devDependency; no existing mock mechanism/handlers exist in the repo). Tests use MSW's Node integration; the dev server uses the browser worker. |
| TC-4 | All remote access goes through a single replaceable request boundary (API/service module using HTTP). UI components must not import mock data or MSW handlers directly, so replacing the mock with a real backend requires no UI changes. The react-hook-form submit handler calls this boundary; the form component does not call `fetch` directly. |
| TC-5 | State: local component state is acceptable. Form state belongs to react-hook-form and must not be mirrored into component state or a store. Apart from the libraries in D8, no new state, routing, form, validation, date, modal or UI libraries are added. |
| TC-6 | No router exists; the feature is a single view rendered from `src/App.tsx`. The filter is not persisted to the URL. |
| TC-7 | Must pass existing `npm run lint` (ESLint + Prettier config) and `npm run build` (`tsc -b`, strict unused-locals/params). TypeScript types for form values and the create payload are **inferred from the zod schema** (input vs. parsed output) rather than declared separately, so types and rules cannot drift. |
| TC-8 | Do not rewrite unrelated code or project configuration beyond what is needed to wire the feature and MSW (e.g. worker registration in dev, test server setup). Exception: TC-13. |
| TC-9 | Mock code must be visibly labelled as mock and implement the contract in §4.3 (D1, D2). |
| TC-10 | **Form handling:** the create-session form is implemented with **react-hook-form** (D8). Field registration, touched/submitted tracking, submitting state and submit handling go through it; no parallel hand-rolled form state. Native inputs are used (text + date-time); no UI component library. |
| TC-11 | **Validation schema:** the rules in §6.1–§6.2 are expressed as a single **zod** schema that is the one source of truth for create-form validation, connected via `@hookform/resolvers` (A12). Error messages are the exact copy in §6; zod default messages never reach the UI. "Now" is evaluated per validation run (VR-D5). |
| TC-12 | **Behavior parity:** using react-hook-form/zod must not change any observable behavior in §5–§7 — in particular VR-P1…VR-P7 and AC-4.2 (react-hook-form's submitting state is not assumed sufficient on its own; repeated click/Enter must provably send exactly one request). |
| TC-13 | **Dependency installation:** `react-hook-form`, `zod` and `@hookform/resolvers` are added as runtime `dependencies` via npm, updating `package.json` and `package-lock.json`. This is the only permitted change to those files for this task. Versions must be compatible with React 19 and TypeScript ~6.0, and the resolver version must support the installed zod major version. |
| TC-14 | **zod at the API boundary (optional):** zod may also be used to parse/narrow `GET`/`POST` response payloads in the request boundary (TC-4) instead of hand-written type guards (A13). Malformed payloads map to the generic error state (UI-5); zod error details are never shown to the user. A response schema must tolerate unknown `status` strings (§6.2 note) rather than rejecting the whole list. |

## 9. Testing Requirements

| ID | Requirement |
| --- | --- |
| TR-1 | At least one automated **behavior-level** test (rendering the workspace, interacting via user events, with MSW intercepting HTTP) covering the core flow. Minimum expected coverage: load list → create valid session → new session visible in list. |
| TR-2 | Recommended additional behavior coverage (owned by `test-generator` if not essential): status filtering incl. reset to All; title validation boundaries (2/3/80/81 chars, whitespace-only); past/now date rejection; pending submit disabled (single request sent); list load error + Retry; create failure preserves input. |
| TR-5 | **Schema tests:** the zod create-session schema is unit-tested directly against every row of the §6.1 boundary table and the §6.2 date rules (required, equal-to-now, past, future), asserting the exact §6 message, the VR-P5 priority, and that the parsed output title is trimmed. |
| TR-6 | **Form behavior tests** go through the rendered form (user events), not through react-hook-form internals: they assert visible messages (exact §6 copy, no zod default text), `aria-invalid`/`aria-describedby`, blur-then-change timing (VR-P2/P3), focus on the first invalid field (VR-P1), and that no `POST` reaches MSW when validation fails. |
| TR-3 | Tests must not depend on a live backend, wall-clock timing flakiness, or the machine's time zone (control "now" where future-date logic is asserted). |
| TR-4 | Report honestly which checks were actually run and their results; unverified behavior must be listed as such in `src/tasks/1/workflow-log.md`. |

## 10. Non-Goals

- Real backend service, database, or persistent storage beyond the in-memory mock.
- Editing, deleting, cancelling, completing, or otherwise changing existing sessions (including changing status).
- Selecting a status in the create form.
- Authentication, authorization, user accounts, multi-trainer support or permission states.
- Additional session fields (description, duration, location, capacity, attendees, trainer, etc.).
- Search, sorting controls, pagination, infinite scroll, multi-status filtering or additional filter controls.
- Persisting the filter in the URL or local storage; deep links; routing.
- Session detail pages.
- Client-side sorting of the list (API order is used — D6).
- Inline/non-modal create panels (modal only — D5).
- A "created but hidden by filter" notice (filter resets to All instead — D3).
- Optimistic updates, offline support, caching/stale-while-revalidate, polling or real-time updates.
- Time-zone selection, recurring sessions, calendar views.
- Full internationalization / translations.
- Changes to unrelated code, tooling or project configuration (except the dependency additions in TC-13).
- Other form or validation libraries (Formik, Yup, Valibot, etc.), react-hook-form DevTools, or schema-driven/generated form UIs.
- Using zod beyond the create form and (optionally) API response parsing — e.g. env/config validation or a shared schema package.
- Async/server-side field validation (e.g. title uniqueness) or validation of fields other than Title and Start date and time.

## 11. Facts (verified in repository, 2026-10-23)

- F1: App is a Vite + React 19 + TypeScript SPA; `src/App.tsx` currently renders an empty fragment (and does not return it).
- F2: Scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`, `test` (`vitest run`), `test:watch`.
- F3: Vitest configured with `globals: true`, `environment: 'jsdom'`, setup `src/test/setup.ts` (jest-dom + cleanup); one sanity test exists.
- F4: Dependencies: `react`, `react-dom`. Dev deps include `msw` ^3.0.3 and Testing Library packages. `react-hook-form` and `@hookform/resolvers` are **not installed**; `zod` 4.6.7 exists only as a transitive dependency and is not declared in `package.json` (checked 2026-10-23).
- F5: No existing mocks, API layer, `public/` directory (MSW worker script not yet generated), router, or living specs (`specs/`, `docs/` absent).
- F6: `src/index.css` defines light/dark design tokens; `index.html` title is "Training Sessions".
- F7: `rulesets/project/` contains no project-specific rules yet.
- F8: No existing form-handling or validation pattern exists in `src/`; react-hook-form + zod (D8) establish the pattern for this repo.

## 12. Decisions And Assumptions

### 12.1 Confirmed Decisions (developer answers, 2026-10-23)

| ID | Decision | Source | Affects |
| --- | --- | --- | --- |
| D1 | Status values are `scheduled`, `completed`, `cancelled` (labels Scheduled / Completed / Cancelled). | OQ-1 | §4.2, US-2 |
| D2 | The API contract is the surface defined in §4.3 (`GET /api/sessions`, `POST /api/sessions`), served by MSW mocks. No error body is defined; any non-2xx/network failure is a generic failure. | OQ-2 | §4.3, TC-3, TC-9 |
| D3 | If the active filter would hide a newly created session, the filter resets to **All**. No "hidden by filter" notice. | OQ-3 | AC-5.3 |
| D4 | If the initial list load failed and a session is then created, the list is not refetched automatically; the error state with Retry remains and the success confirmation is shown. | OQ-4 | AC-5.5 |
| D5 | The create form is presented in a **modal dialog**. | OQ-5 | US-3, US-4, §7.2, UI-2 |
| D6 | The list uses API order; no client-side sorting. New sessions are appended at the end. | OQ-6 | AC-1.8 |
| D7 | State may stay in components. The exact state ownership and request-boundary module shape are left to `architect` / `writing-plans` within TC-4 and TC-5. | OQ-7 | TC-5 |
| D8 | **zod** and **react-hook-form** are added to the tech stack: react-hook-form for the create form, zod for its validation schema (single source of truth for §6). | Developer request, 2026-10-23 | §3, §4.3, §6, §7.2, §8, §9 (TR-5, TR-6), §10 |

### 12.2 Remaining Assumptions (non-blocking)

| ID | Assumption | Impact if wrong |
| --- | --- | --- |
| A2 | New sessions are created with status `scheduled`, assigned by the server. | AC-5.2/5.3 behavior changes. |
| A3 | `startsAt` is exchanged as an ISO 8601 instant and shown in local time. | Formatting and payload change. |
| A4 | Filtering is client-side over the full loaded list (dataset is small). | Would require server-side filter params and per-filter loading states. |
| A7 | The modal cannot be closed while a create request is pending. | Would need defined behavior for late responses after close. |
| A9 | Title length uses JavaScript string length on the trimmed value. | Emoji/combined characters could count differently. |
| A10 | Submit is disabled only while pending, not while invalid. | Validation UX changes. |
| A11 | "Future" is checked against the client clock at submit time; no minimum lead time. | A minimum lead time would add a rule. |
| A12 | "react-hook-forms" in the request means the npm package `react-hook-form`; `@hookform/resolvers` (zod resolver) is accepted as part of D8, since it is the standard bridge between the two. | If the resolver is not wanted, the zod schema must be invoked through a custom resolver; no behavior change. |
| A13 | zod use is required for form validation; use at the API boundary is permitted but optional. | If required at the boundary too, TC-14 becomes mandatory. |
| A14 | `zod` is installed as a direct dependency at major version 4 (v4.6.7 is already present in `node_modules` as a transitive dependency, but is **not** declared in `package.json`). | If v3 is required, schema APIs differ. |

Former assumptions A1, A5, A6 and A8 are now confirmed as D1, D6, D3 and D4.

## 13. Open Questions

All open questions from rev. 1 are resolved:

| ID | Question | Answer | Decision |
| --- | --- | --- | --- |
| OQ-1 | Confirmed status values and labels? | `scheduled`, `completed`, `cancelled` | D1 |
| OQ-2 | Real API contract (paths, payloads, error shape)? | As defined in §4.3, mocked via MSW | D2 |
| OQ-3 | Reset filter to All, or keep filter and notify? | "Yes" — interpreted as reset to All (the proposed A6) | D3 |
| OQ-4 | Refetch, show only new session, or keep error after failed initial load? | Keep error, no auto-refetch (A8) | D4 |
| OQ-5 | Modal vs. inline panel? | Modal | D5 |
| OQ-6 | Sort list or use API order? | API order | D6 |
| OQ-7 | State ownership and request boundary shape? | Local state | D7 |

> Note on OQ-3: the answer "yes" was read as accepting the proposed default (reset to All). If the intent was "keep the filter and notify", AC-5.3 and D3 must be revised.

## 14. Specialist Gaps (non-blocking)

| Gap | Owner |
| --- | --- |
| Modal visual design, filter control type (select vs. segmented buttons), state visuals, over-length title handling (VR-T6), copy refinement | `ui-designer` (optional) |
| Whether a zustand store is used, request boundary module layout, MSW wiring for dev (worker) and tests (node server) | `architect` or decided during `writing-plans` |
| react-hook-form validation mode/configuration meeting VR-P1…VR-P7; how VR-P5 priority is guaranteed in the schema; how "now" is supplied for VR-D5 and tests; schema module placement shared by form and mock; whether zod is used at the API boundary (TC-14) | `writing-plans` (or `architect`) |

## 15. Readiness

**Ready for re-planning.** All open questions are resolved (D1–D8). The requirements now reflect zod + react-hook-form in scope (§3), mock behavior (§4.3), validation rules (§6 intro, VR-T4, VR-D5, VR-P1/P5/P7), form states (§7.2), tech stack and constraints (§8), tests (TR-5, TR-6) and non-goals (§10). Remaining assumptions (incl. A12–A14) are non-blocking defaults.

> **Impact on the existing plan:** `src/tasks/1/implementation-plan.md` was written before D8. It assumes hand-written pure validation functions (T2), hand-rolled form state (T8), manual type guards at the API boundary (T3), and states that no dependency installation is required (§9). Those parts are now out of date and the plan must be revised with `writing-plans` before `coder` starts.
