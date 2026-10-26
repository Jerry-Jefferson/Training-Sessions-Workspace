# TASK-1: Implementation Plan — Trainer Workspace & Training Sessions

Source requirements: `src/tasks/1/requirements.md` (rev. 4, decisions D1–D8)
Plan author role: `writing-plans` · Date: 2026-10-23 · **Plan rev. 2.1** (aligned with D8: zod + react-hook-form; rev. 2.1 on 2026-10-26 reconciles review finding F3)
Application Root: repository root (single Vite + React app; no monorepo).

### Changes in rev. 2.1 (review F3 — documentation only)

- P9, T0 and §9: `@hookform/resolvers` is `^5.9.2`, not `^6.0.0`. `npm install` of 6.0.0 failed with an ERESOLVE conflict (optional peer `effect@^4` vs `effect@3.22.4`), and the developer chose `^5` on 2026-10-26 (see workflow log).
- P4, T4 and T9: MSW 3 renamed the `onUnhandledRequest` option to `onUnhandledFrame`. The values (`"error"` in tests, `"bypass"` in dev) are unchanged.

### Changes vs. plan rev. 1

- New **T0** installs `react-hook-form`, `zod`, `@hookform/resolvers` (TC-13).
- **T2** now builds the zod create-session schema (single source of truth, TC-11) instead of hand-written validation functions; types are inferred from it (TC-7).
- **T3** parses responses with zod (TC-14 option taken — see P8).
- **T4** mock `POST` validates with the shared schema (§4.3).
- **T8** form built with react-hook-form + zod resolver (TC-10), no hand-rolled form state.
- **T10** adds schema tests (TR-5) and form behavior tests (TR-6).
- §9 verification now includes the one-time dependency install.

---

## 1. Current Behavior

- `src/App.tsx` declares `App` but **does not return anything**, so the app renders nothing.
- `src/main.tsx` renders `<App />` inside `StrictMode`; imports `./index.css` (light/dark design tokens).
- No API layer, mocks, forms, validation, feature code, `public/` directory or router exist (F5, F8).
- Tests: Vitest 5 (`globals`, `jsdom`, setup `src/test/setup.ts` with jest-dom + `cleanup`), one sanity test.
- `msw` 3.0.3 installed (dev) but unused.
- `react-hook-form` and `@hookform/resolvers` are not installed; `zod` 4.6.7 is present only transitively (via `eslint-plugin-react-hooks`) and not declared in `package.json` (F4).

## 2. Intended Behavior

A single workspace page that:

1. Loads sessions via `GET /api/sessions` (MSW-mocked) with loading, loaded, empty, filtered-empty and error+Retry states.
2. Filters client-side by one status control: All / Scheduled / Completed / Cancelled.
3. Opens a **modal** create form (Title, Start date and time) built with **react-hook-form**, validated by one **zod** schema with the exact §6 messages and timing (VR-P1…VR-P7).
4. Submits via `POST /api/sessions` (trimmed title + ISO instant from the schema's parsed output), blocks duplicate submits while pending, handles failure inside the modal as a form-level error.
5. Appends the created session to the list (API order), resetting the filter to All if it would hide it (D3); keeps the list error state if initial load had failed (D4).

## 3. Preconditions And Confirmed Decisions

| Ref | Decision used by this plan |
| --- | --- |
| D1 | Statuses `scheduled` / `completed` / `cancelled`; labels Scheduled / Completed / Cancelled. |
| D2 | `GET /api/sessions` → `200 Session[]`; `POST /api/sessions` `{ title, startsAt }` → `201 Session`; any non-2xx/network failure = generic failure. |
| D3 | Filter resets to All when it would hide the new session. |
| D4 | No auto-refetch after create when initial load failed. |
| D5 | Create form in a modal dialog. |
| D6 | API order, new sessions appended. |
| D7 | **This plan uses local React state** for list/filter/modal (§5.1); form state is owned by react-hook-form (TC-5). |
| D8 | react-hook-form for the form, zod for the schema, `@hookform/resolvers` as bridge (A12), zod v4 (A14). |

### 3.1 Technical Decisions Made By This Plan (verified against installed tooling / npm registry)

| ID | Decision | Evidence / rationale |
| --- | --- | --- |
| P1 | **Custom accessible modal** (`role="dialog"`, `aria-modal="true"`, focus trap, Escape, background `inert`) instead of native `<dialog>.showModal()`. | Verified: jsdom in this repo has no `HTMLDialogElement.showModal`; native dialog can't be behavior-tested. No modal library allowed (TC-5). |
| P2 | API client resolves paths to **absolute URLs** against `window.location.origin`. | Verified: Node `fetch` under Vitest throws `Failed to parse URL from /api/x` for relative URLs. |
| P3 | Dev MSW worker served by `msw()` from `msw/vite` in `mode: 'worker-only'` + stable `setupWorker` from `msw/browser`. | `msw@3.0.3` exports `./vite`; no generated `public/` file, no experimental `virtual:msw` API, no new dependency. |
| P4 | Tests use `setupServer` from `msw/node`, lifecycle in `src/test/setup.ts`, `onUnhandledFrame: 'error'`. | Existing global setup file. |
| P5 | Mock latency via MSW `delay()` (no argument). | Verified in `msw/lib/utils/delay.js`: 100–400 ms in browser, 5 ms in Node. |
| P6 | Date input: single native `<input type="datetime-local">`. | One labelled control, local-time semantics (VR-D2/VR-D4), no date library (TC-5). |
| P7 | New files follow `.prettierrc` (double quotes, semicolons, width 100, trailing commas es5); existing files are not reformatted. | Prettier is not installed and there is no format script — enforced by convention/review only. |
| P8 | **zod is also used for response parsing** (TC-14 option taken): one `sessionSchema` with `status: z.string()` (tolerates unknown statuses, §6.2 note). | Removes hand-written guards; zod is already a dependency after T0. Parse failures map to `SessionsRequestError` → generic UI error (UI-5). |
| P9 | Versions for T0: `react-hook-form@^7.90.0` (peer `react ^19` ✓), `zod@^4.6.7` (matches the version already in the tree, A14), `@hookform/resolvers@^5.9.2` (peer `zod ^3.25 \|\| ^4`, `react-hook-form ^7.55`; other validator peers are optional ✓). | `npm view` on 2026-10-23; resolvers version per T0 install on 2026-10-26. |
| P10 | react-hook-form config: `mode: 'onTouched'`, `reValidateMode: 'onChange'`, `shouldFocusError: true` (default), `criteriaMode: 'firstError'` (default), `defaultValues: { title: '', startsAt: '' }`. | `onTouched` = first validation on blur, then on every change (VR-P2/P3); after a submit attempt, `reValidateMode: 'onChange'` re-validates untouched fields too; `shouldFocusError` focuses the first registered invalid field in registration order = visual order (VR-P1). |
| P11 | **Pending state uses `readOnly` inputs, not react-hook-form's `disabled`.** | react-hook-form treats `disabled` fields as `undefined` in values; with `readOnly`, values are kept exactly as typed if the request fails (AC-4.5). Submit + Cancel buttons are `disabled` while pending. |
| P12 | **Duplicate-submit guard = synchronous `useRef` flag + `formState.isSubmitting`.** | `isSubmitting` updates only after a re-render; a fast double click / Enter can call `handleSubmit` twice before that. The ref closes the gap (TC-12, AC-4.2). |
| P13 | **No `watch()` / `useWatch` needed.** | `eslint-plugin-react-hooks` 7 flags `watch` as incompatible with memoization (`react-hooks/incompatible-library`); the form doesn't need live values. |

### 3.2 Lint / TypeScript Constraints To Respect In Every Task

- `verbatimModuleSyntax`: type-only imports use `import type` (e.g. `import type { z } from "zod"` is **not** valid when `z` is also used as a value — import `{ z }` as a value and use `z.input<…>` / `z.output<…>` types).
- `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties.
- `noUnusedLocals` / `noUnusedParameters`.
- `react-refresh/only-export-components`: component files export only components; schemas, constants, hooks and helpers live in separate modules.
- `eslint-plugin-react-hooks` 7 recommended (exhaustive deps, compiler-style rules — see P13).
- Narrow `unknown` JSON with zod at the API boundary; no `any`, no unchecked `as`.

---

## 4. Target File Layout

```text
package.json, package-lock.json               (modify, T0 only)  add 3 runtime dependencies
src/
├── App.tsx                                   (modify)  render <SessionsWorkspace />
├── main.tsx                                  (modify)  start MSW worker in DEV before render
├── features/sessions/
│   ├── types.ts                              (new)     statuses, labels, filter type, label helper
│   ├── schemas.ts                            (new)     zod: sessionSchema, sessionListSchema, createSessionSchema factory; inferred types
│   ├── dateTime.ts                           (new)     local input → ISO, display formatting
│   ├── api/sessionsApi.ts                    (new)     request boundary: fetchSessions, createSession, error type
│   ├── useSessions.ts                        (new)     list remote-state hook
│   ├── components/
│   │   ├── SessionsWorkspace.tsx             (new)     page container, owns list/filter/modal state
│   │   ├── StatusFilter.tsx                  (new)     single status filter control
│   │   ├── SessionList.tsx                   (new)     loading/error/empty/filtered-empty/list
│   │   ├── Modal.tsx                         (new)     generic accessible modal shell
│   │   └── CreateSessionForm.tsx             (new)     react-hook-form + zodResolver form
│   ├── sessions.css                          (new)     feature styles using index.css tokens
│   └── __tests__/
│       ├── schemas.test.ts                   (new)     TR-5 schema unit tests
│       ├── CreateSessionForm.test.tsx        (new)     TR-6 form behavior tests
│       └── SessionsWorkspace.test.tsx        (new)     TR-1/TR-2 workspace behavior tests via MSW
├── mocks/
│   ├── db.ts                                 (new)     in-memory sessions store + reset (MOCK)
│   ├── handlers.ts                           (new)     GET/POST /api/sessions handlers (MOCK)
│   ├── browser.ts                            (new)     setupWorker(...handlers)
│   └── server.ts                             (new)     setupServer(...handlers)
└── test/setup.ts                             (modify)  MSW server lifecycle + db reset
vite.config.ts                                (modify)  add msw() plugin, worker-only
```

Not touched: `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `index.html`, `src/index.css`, `src/test/sanity.test.tsx`, rulesets, `.claude/`. `package.json` / `package-lock.json` change **only** through the T0 install (TC-13).

---

## 5. Contracts Between Steps

### 5.1 State ownership

| State | Owner | Lifecycle |
| --- | --- | --- |
| Remote list `{ status: 'loading' \| 'error' \| 'success', sessions }` | `useSessions` (called once in `SessionsWorkspace`) | Mount; reload on Retry; `addSession` appends |
| Selected filter `'all' \| SessionStatus` | `SessionsWorkspace` (`useState`, default `'all'`) | Transient |
| Visible sessions | **Derived** during render in `SessionsWorkspace` | — |
| Modal open/closed | `SessionsWorkspace` | Transient |
| Form values, errors, touched, submitted, submitting, root (server) error | **react-hook-form** inside `CreateSessionForm` (TC-5, TC-10) — never mirrored into component state | Destroyed when the modal closes (form unmounts) → fresh state on reopen (AC-3.5) |
| Duplicate-submit guard | `useRef<boolean>` in `CreateSessionForm` (P12) | Per submit |
| Success announcement | `SessionsWorkspace` live region | Replaced on next create |

### 5.2 Module contracts (signatures, not implementations)

- **`types.ts`**
  - `SESSION_STATUSES = ["scheduled", "completed", "cancelled"] as const`; `type SessionStatus`.
  - `SESSION_STATUS_LABELS: Record<SessionStatus, string>`; `isKnownStatus(value: string): value is SessionStatus`; `getStatusLabel(status: string): string` (raw value fallback).
  - `type StatusFilterValue = "all" | SessionStatus`.
- **`schemas.ts`** (single source of truth — TC-7, TC-11)
  - Exported message constants with the exact §6 copy (`TITLE_REQUIRED`, `TITLE_TOO_SHORT`, `TITLE_TOO_LONG`, `STARTS_AT_REQUIRED`, `STARTS_AT_NOT_FUTURE`) and `TITLE_MIN_LENGTH = 3`, `TITLE_MAX_LENGTH = 80`.
  - `sessionSchema`: `{ id: string, title: string, status: string, startsAt: string }` (P8); `sessionListSchema = z.array(sessionSchema)`; `type Session = z.output<typeof sessionSchema>`.
  - `createCreateSessionSchema(getNow: () => Date = () => new Date())` returning a schema whose **input** is `{ title: string; startsAt: string /* datetime-local value */ }` and whose **output** is `{ title: string /* trimmed */; startsAt: string /* ISO */ }`:
    - `title`: trim → required → min 3 → max 80, checks declared **in priority order**, with `abort` on the required check so a whitespace-only value yields only `TITLE_REQUIRED` (VR-P5). Every check passes an explicit message so zod defaults never appear.
    - `startsAt`: non-empty → parseable as local date-time (failure also reports `STARTS_AT_REQUIRED`, VR-D1) → strictly `> getNow()` evaluated **inside the refinement** on every run (VR-D2, VR-D3, VR-D5) → transform to ISO via `dateTime.localInputToIso` (VR-D4). Required/parse checks abort so an empty value never also shows the future message.
    - Base type errors (e.g. `undefined`) map to the field's required message (custom `error` on `z.string(...)`).
  - `createSessionSchema = createCreateSessionSchema()` (default instance used by the form and the mock).
  - Exported types: `type CreateSessionFormValues = z.input<typeof createSessionSchema>`, `type CreateSessionInput = z.output<typeof createSessionSchema>`.
  - *Implementation note for coder:* confirm the exact zod 4.6 API for per-check abort/messages; correctness is proven by T2 tests, not by the specific API shape.
- **`dateTime.ts`**
  - `localInputToIso(localValue: string): string | null` (parse `YYYY-MM-DDTHH:mm` as local time; `null` if invalid).
  - `formatStartsAt(iso: string): string` — module-level `Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })`.
- **`api/sessionsApi.ts`**
  - `fetchSessions(signal?: AbortSignal): Promise<Session[]>` — `sessionListSchema.safeParse` the JSON.
  - `createSession(input: CreateSessionInput): Promise<Session>` — POST JSON `{ title, startsAt }`; `sessionSchema.safeParse` the response.
  - `class SessionsRequestError extends Error` (fields declared normally) for non-2xx, network failure, invalid JSON, schema mismatch. `AbortError` re-thrown untouched.
  - URLs resolved via `new URL("/api/sessions", window.location.origin)` (P2).
- **`useSessions.ts`** — returns `{ status, sessions, retry(): void, addSession(session: Session): void }`; `AbortController` per load, aborted on unmount/retry (StrictMode-safe).
- **`mocks/db.ts`** — `getSessions()`, `addSession(input: CreateSessionInput): Session` (`crypto.randomUUID()`, status `"scheduled"` — A2), `resetDb()`. Seed 5–6 sessions covering all statuses, mixed past/future dates.
- **`mocks/handlers.ts`** — header comment `MOCK — no real backend; implements contract D2 (requirements §4.3)`.
  - `GET /api/sessions` → `await delay()` → `HttpResponse.json(getSessions())`.
  - `POST /api/sessions` → `await delay()` → parse body as `unknown` → validate `{ title, startsAt }` (title with the same trim/length rules; `startsAt` a valid ISO instant in the future). Because the wire format is already ISO (not the `datetime-local` input), the mock reuses the exported **title rules / message constants and length limits** from `schemas.ts` plus an ISO future check, rather than the form-input schema. → `400` (empty body) on failure, else `201` + created session.
  - Mock imports from `features/sessions/schemas.ts` are allowed; nothing under `features/` imports from `mocks/` (TC-4).

### 5.3 Ordering / parallelism

```text
T0 deps ─> T1 types ─┬─> T2 schemas + dateTime ─┬─> T3 API client ─┐
                     │                          └─> T4 mocks + MSW ┼─> T5 useSessions ─┐
                     │                                             │                   ├─> T7 workspace/filter/list ─> T8 form ─> T9 App/main ─> T10 tests ─> T11 verify
                     └──────────────── T6 Modal shell (independent) ┴───────────────────┘
```

- T3 and T4 can proceed in parallel after T2. T6 can proceed any time after T0.
- Essential tests are written in the task that introduces the behavior; T10 holds the integrated behavior suites.

---

## 6. Ordered Tasks

### T0 — Add approved dependencies (TC-13)

- **Files:** `package.json`, `package-lock.json` (via npm only).
- **Do:** `npm install react-hook-form@^7.90.0 zod@^4.6.7 @hookform/resolvers@^5.9.2` (runtime `dependencies`, P9). No other package changes.
- **Acceptance checks:**
  - [ ] Exactly three entries added to `dependencies`; no devDependency or script changes.
  - [ ] `npm ls zod` shows a single deduped zod 4.x.
  - [ ] No peer-dependency errors for `react-hook-form` / `@hookform/resolvers`.
- **Verify:** `npm ls react-hook-form zod @hookform/resolvers`, `npm test` (sanity test still green), `npm run build`.
- **Stop condition:** if install fails or peers conflict, stop and report — do not use `--force`/`--legacy-peer-deps` without developer approval.

### T1 — Domain types and status metadata

- **Files:** `src/features/sessions/types.ts` (new).
- **Do:** per §5.2. No enums.
- **Acceptance checks:**
  - [ ] Three statuses with labels Scheduled / Completed / Cancelled (D1, AC-2.1).
  - [ ] `getStatusLabel("archived")` → `"archived"` (§6.2 note).
- **Verify:** `npm run lint`, `npm run build`.

### T2 — zod schemas and date/time helpers

- **Files:** `src/features/sessions/schemas.ts`, `src/features/sessions/dateTime.ts`, `src/features/sessions/__tests__/schemas.test.ts` (new).
- **Do:** per §5.2. The create schema is a **factory taking `getNow`** so tests fix "now" without fake timers (VR-D5, TR-3). Form-value and payload types are `z.input` / `z.output` of the schema — no hand-declared duplicates (TC-7).
- **Acceptance checks / essential tests (TR-5)** — `safeParse` with a fixed `now`, asserting the **single first issue message** per field and parsed output:
  - [ ] Title `""`, `"   "` → only `"Title is required."` (VR-T1, VR-P5).
  - [ ] Title `"ab"`, `"  ab  "` → `"Title must be at least 3 characters."` (VR-T2).
  - [ ] Title `"abc"`, `"  abc  "` → success, output `"abc"` (VR-T4).
  - [ ] Title 80 chars → success; 81 chars → `"Title must be at most 80 characters."`; 80 chars + surrounding spaces → success, output length 80 (VR-T3).
  - [ ] Internal whitespace preserved in output (`"a  b c"` stays as is) (VR-T4).
  - [ ] `startsAt` `""` and `"not-a-date"` → only `"Start date and time is required."` (VR-D1, VR-P5).
  - [ ] `startsAt` equal to `now` and 1 minute before → `"Start date and time must be in the future."`; 1 minute after → success (VR-D2).
  - [ ] VR-D3/VR-D5: same schema instance, same input, `getNow` advanced past the value between two parses → second parse fails.
  - [ ] Output `startsAt` is ISO; formatting it with local-time getters yields the entered local date/time (VR-D4). Build inputs from local components (time-zone independent, TR-3).
  - [ ] No issue message in any case equals a zod default (assert messages ∈ the five constants).
  - [ ] `sessionSchema` accepts an unknown `status` string; rejects a missing `title`.
- **Verify:** `npm test`, `npm run lint`.

### T3 — Request boundary (API client)

- **Files:** `src/features/sessions/api/sessionsApi.ts` (new).
- **Do:** per §5.2; zod parsing of responses (P8), absolute URLs (P2), generic `SessionsRequestError`.
- **Acceptance checks:**
  - [ ] No `fetch` calls outside this module (TC-4) — grep in T11.
  - [ ] zod error details never surface in UI copy (UI-5).
- **Verify:** `npm run lint`, `npm run build`; behavior via T10.

### T4 — Mock layer and MSW wiring (no backend)

- **Files:** `src/mocks/db.ts`, `src/mocks/handlers.ts`, `src/mocks/browser.ts`, `src/mocks/server.ts` (new); `vite.config.ts`, `src/test/setup.ts` (modify).
- **Do:**
  - `db.ts` / `handlers.ts` per §5.2 (MOCK-labelled, TC-9).
  - `browser.ts`: `setupWorker(...handlers)` (`msw/browser`); `server.ts`: `setupServer(...handlers)` (`msw/node`).
  - `vite.config.ts`: add `msw({ mode: "worker-only" })` from `msw/vite`; keep `react()` and the `test` block unchanged.
  - `src/test/setup.ts`: keep existing lines; add `beforeAll` → `server.listen({ onUnhandledFrame: "error" })`, `afterEach` → `server.resetHandlers()` + `resetDb()`, `afterAll` → `server.close()`.
- **Acceptance checks:**
  - [ ] No server process, database or real endpoint (Non-Goals).
  - [ ] Mock `POST` → `400` for a 2-char title, an 81-char title, a past `startsAt`; `201` + `status: "scheduled"` + unique `id` otherwise (§4.3, A2).
  - [ ] `src/test/sanity.test.tsx` still passes.
- **Verify:** `npm test`, `npm run lint`, `npm run build` (confirms `msw/vite` types resolve under `tsconfig.node.json`). If `msw/vite` fails, **stop and report**; the fallback (`npx msw init public`) needs developer approval.

### T5 — `useSessions` hook

- **Files:** `src/features/sessions/useSessions.ts` (new).
- **Do:** per §5.1/§5.2. Initial `loading`; success → API-ordered sessions; `SessionsRequestError` → `error`; aborted → ignored. `retry()` → `loading` + reload. `addSession` appends via functional update; if status is `error`, it stays `error` (D4) and the next successful Retry replaces the list with server data, so the session appears once (AC-5.6).
- **Acceptance checks:** AC-1.1, 1.5, 1.6, 1.8, 5.1, 5.5, 5.6 reachable through this API; no duplicate GET races under StrictMode.
- **Verify:** `npm run lint`; behavior via T10.

### T6 — Generic accessible `Modal` shell

- **Files:** `src/features/sessions/components/Modal.tsx` (new).
- **Do:** props roughly `{ title, onClose, closeDisabled, children }`. `createPortal` to `document.body` (outside `#root`); `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; focus first focusable on mount; trap Tab/Shift+Tab; Escape → `onClose` unless `closeDisabled`; set `inert` on `#root` while open; restore focus to the previously focused element on unmount.
- **Acceptance checks:** AC-3.3, AC-3.4, AC-3.6, AC-4.3 (`closeDisabled`), UI-2 (max-height with internal scroll at 320 px).
- **Verify:** `npm run lint`; behavior via T10.

### T7 — Workspace container, status filter, session list

- **Files:** `components/SessionsWorkspace.tsx`, `components/StatusFilter.tsx`, `components/SessionList.tsx`, `sessions.css` (new).
- **Do:**
  - `SessionsWorkspace`: heading "Training sessions", always-enabled "Create session" button (AC-3.1), `StatusFilter`, `SessionList`, polite live region; owns filter + modal state; derives visible sessions.
  - `StatusFilter`: one native `<select>` labelled "Status" (All/Scheduled/Completed/Cancelled); disabled unless list status is `success` (AC-2.1, 2.6, 2.7).
  - `SessionList` states (requirements §7.1): loading `role="status"` "Loading sessions…"; error `role="alert"` "We couldn't load your training sessions." + Retry; empty "No training sessions yet."; filtered-empty "No {label lowercase} sessions."; else `<ul>`/`<li>` with title, status label text, `<time dateTime={iso}>{formatStartsAt(iso)}</time>`.
  - `sessions.css`: existing CSS variables only; visible `:focus-visible`; no horizontal scroll from 320 px (UI-1…UI-3).
- **Acceptance checks:** AC-1.1–1.8, AC-2.1–2.7, AC-3.1, UI-1…UI-5.
- **Verify:** `npm run lint`, `npm run build`; behavior via T10.

### T8 — Create session form (react-hook-form + zod)

- **Files:** `components/CreateSessionForm.tsx` (new); `components/SessionsWorkspace.tsx` (wire modal + `onCreated`).
- **Do:**
  - `useForm<CreateSessionFormValues, unknown, CreateSessionInput>` with `resolver: zodResolver(createSessionSchema)` and the P10 options. Submit handler receives the **parsed output** (trimmed title, ISO `startsAt`) and passes it unchanged to `createSession` (AC-4.1, VR-T4, VR-D4).
  - `<form noValidate>`; inputs registered via `register("title")` / `register("startsAt")`; **no** `required`/`minLength`/`maxLength`/`min` attributes (requirements §6 intro, VR-T6 — typing beyond 80 chars is allowed and shows the max-length error).
  - Labels with `htmlFor`; error `<p id>` linked via `aria-describedby`; `aria-invalid` from `formState.errors.<field>` (VR-P4). Display `errors.<field>.message` only (first error, P10).
  - Submit flow: guard ref (P12) → `clearErrors("root")` → `await createSession(...)`; on `SessionsRequestError` → `setError("root.server", { message: "Could not create the session. Please try again." })` rendered as form-level `role="alert"`, fields **not** marked invalid, values untouched (AC-4.5, VR-P7); always release the guard in `finally`.
  - Pending (`formState.isSubmitting`): inputs `readOnly` (P11), submit `disabled` with label "Creating…", Cancel disabled, `Modal` `closeDisabled` (AC-4.2, AC-4.3).
  - Success → `onCreated(session)`; workspace: `addSession(session)`; if filter ≠ `"all"` and ≠ `session.status` → set `"all"` (D3, AC-5.2/5.3); close modal (form unmounts → full react-hook-form reset, AC-3.5); announce `Session "{title}" created.` (AC-4.4).
  - Cancel button / Escape → close and discard (AC-3.4).
  - No `watch()` (P13); no form values copied into `useState` (TC-5).
- **Acceptance checks:** US-3, US-4, US-5; VR-P1…VR-P7; §7.2 states.
- **Verify:** `npm run lint` (no `react-hooks/incompatible-library` warnings), `npm run build`; behavior via T10.

### T9 — App entry wiring

- **Files:** `src/App.tsx`, `src/main.tsx` (modify).
- **Do:** `App` returns `<SessionsWorkspace />` (fixes missing `return`). `main.tsx`: when `import.meta.env.DEV`, dynamically import `./mocks/browser` and `await worker.start({ onUnhandledFrame: "bypass" })` before rendering; keep `StrictMode` and CSS import.
- **Acceptance checks:** dev shows loading then seed sessions; production build contains no worker start path.
- **Verify:** `npm run build`, `npm run lint`, manual `npm run dev` (T11).

### T10 — Behavior-level tests (TR-1, TR-2, TR-6)

- **Files:** `__tests__/CreateSessionForm.test.tsx`, `__tests__/SessionsWorkspace.test.tsx` (new).
- **Approach:** render through `<App />` / `<SessionsWorkspace />` (or `CreateSessionForm` with an `onCreated` spy for TR-6), `@testing-library/user-event`, accessible queries; MSW `server.use(...)` overrides for failure/latency; count POSTs via a handler spy or `server.events`. Future dates computed from real `Date.now()` + 7 days formatted as local `YYYY-MM-DDTHH:mm`; past dates −1 day (no fake timers — avoids fighting user-event/MSW timers).
- **Essential — `SessionsWorkspace.test.tsx`:**
  1. **Core flow (TR-1):** loading → seed sessions with title/status/date → open modal → title `"  Team kickoff  "` + future date → submit → modal closes → list contains `"Team kickoff"` with "Scheduled" → success announcement.
  2. **Filtering:** "Completed" → only completed; "All" → all; status with no sessions (via `server.use` seed) → filtered-empty message.
  3. **List error + Retry:** first GET 500 → alert + Retry → second GET OK → list.
  4. **Create failure:** POST 500 → modal open, form-level alert, values preserved exactly as typed (incl. surrounding spaces), fields not `aria-invalid`, submit re-enabled, list unchanged.
  5. **Filter reset on create (D3):** filter "Completed" → create → filter shows "All", new session visible.
- **Essential — `CreateSessionForm.test.tsx` (TR-6):**
  6. **Blur-then-change timing:** typing `"ab"` shows no error until blur; after blur shows min-length message; typing `"c"` clears it (VR-P2/P3).
  7. **Submit blocked when invalid:** whitespace-only title + past date → submit → exact `"Title is required."` and `"Start date and time must be in the future."`, `aria-invalid="true"` + `aria-describedby` pointing at the message, focus on Title, **zero** POSTs (VR-P1, VR-P4, VR-P5).
  8. **No zod default text:** empty date → `"Start date and time is required."`; assert no element contains "Invalid input" / "Expected".
  9. **Duplicate submit:** POST override with `delay(200)`; double-click submit + press Enter → exactly one POST; button disabled, label "Creating…", inputs read-only (AC-4.2, AC-4.3, TC-12).
  10. **Payload:** POST body has trimmed title and ISO `startsAt` (AC-4.1).
- **Verify:** `npm test` — all green, no MSW unhandled-request errors, no `act` warnings.

### T11 — Final verification and reporting

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. Boundary greps: nothing under `src/features/` imports from `src/mocks/`; `fetch(` only in `sessionsApi.ts`; no `enum`/`any`; no `required`/`minLength`/`maxLength` attributes on the form inputs; no `watch(` in the form.
5. `git diff -- package.json` shows only the three D8 dependencies.
6. Manual `npm run dev` (URL printed by Vite): list → filter → create; modal keyboard behavior; validation timing; 320 px width; dark mode. Note anything not exercised (e.g. list error in the browser) as unverified.
7. Record results in `src/tasks/1/workflow-log.md` (Manual Browser Observation, Completion). Browser-verify capability is currently BLOCKED per the log (TR-4).

---

## 7. Requirement Traceability

| Requirement | Task(s) | Test(s) |
| --- | --- | --- |
| AC-1.1–1.3, 1.8 | T3, T5, T7 | T10-1 |
| AC-1.4 | T7 | additional |
| AC-1.5–1.7 | T5, T7 | T10-3 |
| AC-2.1–2.7 | T7 | T10-2 |
| AC-3.1–3.6 | T6, T8 | T10-1 (open), additional (Escape/focus/reopen) |
| AC-4.1–4.6 | T3, T8 | T10-1, T10-4, T10-9, T10-10 |
| AC-5.1–5.4, 5.6 | T5, T8 | T10-1, T10-5 |
| AC-5.5 (D4) | T5, T8 | additional |
| VR-T1–T6 | T2, T8 | T2 (TR-5), T10-6, T10-7 |
| VR-D1–D5 | T2, T8 | T2 (TR-5), T10-7, T10-8 |
| VR-P1–P7 | T8 | T10-4, T10-6, T10-7, T10-8 |
| UI-1–UI-5 | T6, T7 | partial; visuals manual (T11) |
| TC-1–TC-14 | T0–T11 | T11 checks |
| TR-1 / TR-2 / TR-5 / TR-6 | T10 / T10 / T2 / T10 | — |

## 8. Additional Risk-Based Tests (optional, owner `test-generator`)

- Empty list (`GET` → `[]`) and create from empty (AC-1.4, AC-5.4).
- Create while list in error → error + Retry remain; after Retry the new session appears exactly once (AC-5.5, AC-5.6).
- Modal: Escape closes and returns focus to "Create session"; Tab cycles inside; Escape ignored while pending (AC-3.4, AC-4.3).
- Reopen after cancel and after success → empty fields, no errors, no touched state (AC-3.5).
- Malformed `GET` payload → error state; unknown status rendered with raw label and excluded from specific filters.
- 81-char title typed in full (not truncated) shows max-length error (VR-T6).
- Mock `POST` 400 path surfaces as generic form-level error (§4.3).

## 9. Verification Commands

| Command | Purpose |
| --- | --- |
| `npm install react-hook-form@^7.90.0 zod@^4.6.7 @hookform/resolvers@^5.9.2` | **One-time, T0 only** — approved by D8/TC-13 |
| `npm run lint` | ESLint (TS, react-hooks, react-refresh, prettier-compat) |
| `npm test` | Vitest run (jsdom, MSW node server) |
| `npm run build` | `tsc -b` type-check + Vite production build |
| `npm run dev` | Manual browser check with MSW worker (DEV only) |

There is no Prettier binary or format script — formatting per P7 is by convention.

## 10. Risks And Rollback

| Risk | Mitigation |
| --- | --- |
| zod 4 reports several issues per field; wrong one shown. | Checks ordered by priority with abort on required/parse checks; react-hook-form `criteriaMode: 'firstError'`; proven by T2 and T10-7/8. |
| "Now" captured once → stale future check. | Refinement calls `getNow()` per run (factory); T2 VR-D5 test. |
| `disabled` fields drop values in react-hook-form. | `readOnly` during pending (P11); T10-4 asserts preserved values. |
| Double submit before `isSubmitting` re-render. | Ref guard (P12); T10-9. |
| react-hooks v7 compiler lint flags react-hook-form APIs. | Avoid `watch` (P13); if lint still flags `useForm` usage, report rather than disabling rules. |
| Dependency install conflict. | T0 stop condition; no `--force`. |
| `msw/vite` worker-only plugin issues (MSW 3 is new). | Detected in T4; stop and ask before `npx msw init public`. |
| Relative-URL fetch fails in tests. | P2; proven by T10. |
| StrictMode double effect. | AbortController in `useSessions`. |
| Time-zone-dependent tests. | Local-component dates; injected `getNow` (TR-3). |

**Rollback:** the feature is additive under `src/features/sessions/` and `src/mocks/`. Reverting the commit restores `App.tsx`, `main.tsx`, `vite.config.ts`, `src/test/setup.ts`, `package.json` and `package-lock.json`. No feature flag is warranted.

## 11. Readiness

Plan is actionable and consistent with requirements rev. 4. No specialist decision is missing: form/validation configuration (P10–P13), schema placement and "now" injection (§5.2), and response parsing with zod (P8) are decided above. Conditional stops: T0 (install conflict) and T4 (`msw/vite` fallback) require developer approval if triggered. Recommended next role: `coder`.
