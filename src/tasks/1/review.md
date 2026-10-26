# TASK-1: Review

## Code Review Report — 2026-10-26 (`code-reviewer`)

- Review started: `2026-10-26 10:34 +03:00`
- Review surface: working-tree diff against `HEAD` (`6ed0398`, branch `develop`): modified `package.json`, `package-lock.json`, `src/App.tsx`, `src/main.tsx`, `src/test/setup.ts`, `vite.config.ts`; new `src/features/sessions/**`, `src/mocks/**`, `src/test/dateInputs.ts`.
- Sources read: `requirements.md` (rev. 4), `implementation-plan.md` (rev. 2), `workflow-log.md`, all feature, mock and test files, `rulesets/common/code-reviewer`, `rulesets/framework/code-reviewer` (`rulesets/project` has no rules).
- Mode: read-only audit. No production code, tests or configuration were changed.

### Verdict

> **Superseded** by the [Re-review — 2026-10-26 10:59](#re-review--2026-10-26-1059-code-reviewer) below: **APPROVED**.

**REJECTED (NEEDS-CHANGES).** The audit found one should-fix defect (F1). Every other boundary rule and static check passes. The fix is small (a schema tightening and a regression test), and the feature is otherwise ready.

### Static Checks (run by reviewer)

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS | exit 0, no output |
| `npm test` | PASS | 5 files, 53/53 tests; log has no `act(...)`, MSW unhandled-request or stderr warnings (`onUnhandledFrame: "error"` active in `src/test/setup.ts`) |
| `npm run build` | PASS | `tsc -b` clean; `dist/assets/index-*.js` 345.43 kB (106.94 kB gzip) |
| Worker code absent from production JS | PASS | no `setupWorker` / `mockServiceWorker` / seed data in `dist/assets/*.js` (inert `dist/mockServiceWorker.js` is emitted but never registered) |

### Boundary Rules

| # | Rule | Result | Evidence |
| --- | --- | --- | --- |
| 1 | No real backend or DB; 100% MSW | PASS | No absolute `http(s)://` URLs in `src`; only `/api/sessions` resolved against `window.location.origin`; data in `src/mocks/db.ts` (in-memory, MOCK-labelled); worker started only under `import.meta.env.DEV` (`src/main.tsx`) |
| 2 | `fetch` only in `sessionsApi.ts` | PASS | single hit `src/features/sessions/api/sessionsApi.ts:36`; nothing under `src/features` imports `src/mocks` (TC-4) |
| 3 | No `any` / `enum` | PASS | grep over `src/**/*.ts(x)` returns nothing; statuses are an `as const` tuple (`types.ts:1`) |
| 4 | No native `required` / `minLength` / `maxLength` on inputs | PASS | none in `CreateSessionForm.tsx`; `<form noValidate>` (line 81); no `min`/`pattern`/`watch(` either |
| 5 | Only `react-hook-form`, `zod`, `@hookform/resolvers` added | PASS (with note) | `package.json` adds exactly these three (`^7.91.0`, `^4.6.7`, `^5.9.2`); lockfile adds only their tree (`@standard-schema/utils`).|

### Findings (ordered by severity)

#### F1 — Should-fix — A malformed `startsAt` from the API crashes the whole app (blank screen)

- **Where:** `src/features/sessions/schemas.ts:18` (`startsAt: z.string()`), `src/features/sessions/dateTime.ts:35-36`, `src/features/sessions/components/SessionList.tsx:54`.
- **Problem:** `sessionSchema` accepts any string as `startsAt`. `formatStartsAt` passes the value to `Intl.DateTimeFormat#format(new Date(iso))`, which **throws** on an invalid date. The reviewer reproduced this in Node: `RangeError: Invalid time value`. The throw happens during render, and the app has no error boundary, so React unmounts the whole root.
- **Failure scenario:** `GET /api/sessions` returns `[{ "id": "1", "title": "x", "status": "scheduled", "startsAt": "" }]` (or `"tomorrow"`, or `null` coerced upstream). `fetchSessions` resolves successfully, the list renders, `formatStartsAt("")` throws, and the user sees a blank page. The heading, the Create action and Retry all disappear.
- **Violates:** TC-14 / plan P8 ("malformed payloads map to the generic error state"); AC-1.7 (failure contained to the list area); UI-5. The request boundary exists to make the backend replaceable, but this payload gets through it.
- **Suggested fix (for follow-up role):** validate `startsAt` at the boundary, e.g. `z.iso.datetime({ offset: true })`, so a bad payload becomes `SessionsRequestError` and shows the list error state. Make `formatStartsAt` defensive as a second layer if needed. Add a regression test that renders the workspace with a malformed `startsAt` and asserts the list error state + Retry.
- **Recommended role:** `debugger` (one minimal verified fix + regression test).

#### F2 — Low (risk, unverified) — The success announcement may be dropped by screen readers

- **Where:** `src/features/sessions/components/SessionsWorkspace.tsx:25,44-46`; `Modal.tsx:50,56`.
- **Observation:** The live region is inside `#root`, and `#root` is still `inert` when React commits the announcement text. `inert` is removed only in the modal's passive-effect cleanup, which runs after that commit. Some browser/AT combinations do not announce changes inside an inert subtree. Also, creating two sessions with the same title sets identical text, so the second success is not re-announced. The message also stays on screen indefinitely, while AC-4.4 asks for a "brief" confirmation.
- **Impact:** possible gap in AC-4.4 / UI-1 for screen-reader users. jsdom cannot show this. A real browser plus screen reader must check it before the issue is escalated.

#### F3 — Low — Plan/log drift (documentation)

- `implementation-plan.md` P9/T0 still names `@hookform/resolvers@^6.0.0` (installed: `^5.9.2`, by developer decision), and T4/T9 still use `onUnhandledRequest` (MSW 3 uses `onUnhandledFrame`). The workflow log already records both. Recommend `docs-generator` or `writing-plans` to reconcile the plan.

#### F4 — Nit — Unchecked cast in test

- `src/features/sessions/__tests__/SessionsWorkspace.test.tsx:231` casts `request.json()` with `as { title: string; startsAt: string }`. This is test-only and has no runtime risk. It sits against the plan's "no unchecked `as`" guidance, which strictly applies only to the API boundary.

### Requirement Coverage Audit

| Area | Result | Notes |
| --- | --- | --- |
| US-1 list states (AC-1.1–1.8) | PASS except F1 | loading `role="status"`, error `role="alert"` + Retry, empty, API order, `<time dateTime>`; StrictMode-safe `AbortController` in `useSessions` |
| US-2 filter (AC-2.1–2.7) | PASS | one native `<select>` labelled "Status", disabled unless `success`; derived filtering, no refetch (tested); filtered-empty copy names the status |
| US-3 modal (AC-3.1–3.6) | PASS | `role="dialog"`, `aria-modal`, `aria-labelledby`; focus to Title; Tab trap; Escape; focus restore; `#root` `inert`; form unmount gives a full RHF reset (tested) |
| US-4 create (AC-4.1–4.6) | PASS | parsed output (trimmed title, ISO) sent; sync `useRef` guard plus `isSubmitting` (mutation-checked by the coder; same-tick double submit test); `readOnly` while pending keeps values; Escape/Close/Cancel blocked while pending (tested); `root.server` error, fields not invalid (tested) |
| US-5 visibility (AC-5.1–5.6) | PASS | append; D3 filter reset (tested); D4 error kept + single occurrence after Retry via `mergeLoaded` (tested) |
| Validation §6 (VR-T*, VR-D*, VR-P*) | PASS | single zod schema with exact copy constants; `abort` ordering gives VR-P5 priority; `getNow` read per parse (VR-D5, tested); `onTouched` + `reValidateMode: "onChange"`; RHF clears `root` on resubmit (VR-P7). Mock reuses `titleSchema` |
| TC-5 / TC-10 state ownership | PASS | form state only in RHF; no `watch`; list/filter/modal local state; no zustand |
| UI-1…UI-3 accessibility / responsive / theming | PARTIAL | tokens only, `:focus-visible`, 44 px targets, `100dvh` modal with internal scroll, wrap/`overflow-wrap:anywhere`. **Not verified in a real browser** (see Residual Gaps) |
| Architecture fit | PASS | `types` / `schemas` / `dateTime` / `api` / hook / components layering; component files export components only (react-refresh) |
| Performance | PASS (note) | derived filtering is O(n) per render on a small list; formatter hoisted to module scope. The bundle includes full `zod` v4 (~107 kB gzip total). Acceptable for this scope; `zod/mini` is an option if size becomes a constraint |
| Security | PASS | no `dangerouslySetInnerHTML`; titles rendered as text; error copy never exposes status codes or zod details (tested for "500") |

### Test Coverage Assessment

Meaningful behavior coverage: the TR-1 core flow, TR-5 schema boundaries and TR-6 form timing, messages, focus, `aria-*`, zero-POST and single-POST are all present and use MSW, StrictMode and no fake timers.

Gaps (for `test-generator`, non-blocking apart from F1's regression test):

- Malformed `GET` payload through the UI (currently only the API unit test checks a shape mismatch; the F1 case is untested).
- Unknown-status session rendered with its raw label and excluded from specific filters (covered only at unit level).
- Create from the empty state (AC-5.4).
- 81-character title typed in the UI shows VR-T3 and is not truncated (VR-T6).
- Mock `POST 400` path surfaced as the generic form error.
- AC-3.6 background `inert` not asserted.

### Identified Risks

| ID | Risk | Mitigation / owner |
| --- | --- | --- |
| R1 | F1 white-screen on malformed API data once a real backend replaces the mock | Fix F1 (`debugger`) |
| R2 | No real-browser verification: MSW worker registration, 320 px layout, dark mode, focus rings, screen-reader announcements (F2) | `browser-verify` once the capability is available, or a manual `npm run dev` pass by the developer |
| R3 | No React error boundary: any render-time throw blanks the app | Out of scope for this task. Note for `architect` |

### Sign-off

**REJECTED.** Fix F1 with a regression test, then re-run `npm run lint`, `npm test` and `npm run build`. A focused re-review of that change is then enough for APPROVED. F2–F4 and the coverage gaps do not block approval but should be tracked.

---

## Re-review — 2026-10-26 10:59 (`code-reviewer`)

- Review started: `2026-10-26 10:59 +03:00`
- Review surface: the same working-tree diff against `HEAD` (`6ed0398`). This pass focuses on the changes made since the first review:
  - `debugger` (log row 10:52): `src/features/sessions/schemas.ts`, `__tests__/schemas.test.ts`, `__tests__/SessionsWorkspace.test.tsx`;
  - `writing-plans`: `implementation-plan.md` rev. 2.1.
- Unchanged files were re-checked through the full test, lint and build runs and the boundary greps below. They were not re-read line by line.
- Mode: read-only audit. No production code, tests or configuration were changed.

### Verdict

**APPROVED (PASS).** The only should-fix finding (F1) is resolved, with a regression test that failed before the fix. The low and nit findings are resolved or tracked below, and none of them blocks approval. All boundary rules and static checks pass.

### Static Checks (re-run by reviewer)

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS | exit 0, no output |
| `npm test` | PASS | 5 files, **58/58** tests (53 before plus 5 new); log has no stderr, `act(...)`, MSW unhandled-request or error-boundary lines |
| `npm run build` | PASS | `tsc -b` clean; `dist/assets/index-*.js` 345.48 kB (106.99 kB gzip), +0.05 kB versus the first review |
| No mock worker code in production JS | PASS | no `setupWorker` / `mockServiceWorker` / seed data in `dist/assets/*.js` |

### Boundary Rules (re-checked)

| # | Rule | Result | Evidence |
| --- | --- | --- | --- |
| 1 | No real backend or DB; mock/MSW only | PASS | no `http(s)://` URLs in `src`; features never import `src/mocks` |
| 2 | `fetch` only in `sessionsApi.ts` | PASS | single hit `src/features/sessions/api/sessionsApi.ts:36` |
| 3 | No `any` / `enum` | PASS | grep over `src/**/*.ts(x)` is empty |
| 4 | No native `required` / `minLength` / `maxLength` on inputs | PASS | none in `src/features/**/*.tsx` (also no `min=`/`pattern=`); `<form noValidate>` unchanged |
| 5 | No unauthorized dependencies | PASS | `package.json` adds only `react-hook-form`, `zod` and `@hookform/resolvers`; the fixes added no packages (the test imports the already-approved `zod`) |

### Status of Earlier Findings

| ID | Status | Evidence |
| --- | --- | --- |
| F1 — malformed `startsAt` crashes the app | **RESOLVED** | Fix at `schemas.ts:19`: `startsAt: z.iso.datetime({ offset: true })`. Malformed payloads now fail `sessionListSchema`, become `SessionsRequestError` and show the list error with Retry (TC-14, AC-1.7). Regression test `SessionsWorkspace.test.tsx:149` asserts the alert, that the heading and the "Create session" button stay, and that Retry recovers. The reviewer saw it fail before the fix: the page body was empty and `formatStartsAt` threw an uncaught `RangeError`. Unit tests `schemas.test.ts:167,174` cover `Z`/offset accepted and `""`, `"not-a-date"` and a time without offset rejected. Reviewer probe: every value tried that zod accepts (including a fractional-second instant and leap day 2028-02-29) formats without throwing; impossible dates (2030-02-29, 2030-02-30, month 13) are rejected. |
| F2 — announcement may be dropped by screen readers | **OPEN (risk, unverified, non-blocking)** | Code unchanged (`SessionsWorkspace.tsx:25,44-46`; `Modal.tsx:50,56`). It cannot be reproduced in jsdom and needs a real browser plus a screen reader (R2). |
| F3 — plan drift | **RESOLVED** | `implementation-plan.md` rev. 2.1 now uses `@hookform/resolvers@^5.9.2` (P9, T0, §9) and `onUnhandledFrame` (P4, T4, T9), and has a change note. |
| F4 — unchecked cast in test | **RESOLVED as flagged; same pattern remains elsewhere (nit)** | `SessionsWorkspace.test.tsx:255` now parses with `createdBodySchema` (zod). The same `as { title: string; startsAt: string }` cast remains at `CreateSessionForm.test.tsx:95,152`. This is test-only and has no runtime risk. |

### New Findings

None blocking. One low note:

- **N1 — Low (contract strictness, by design):** `z.iso.datetime({ offset: true })` requires seconds, and one invalid row turns the **whole** list into the error state. A future real backend that sends `2030-06-15T10:00+02:00` (valid ISO 8601 without seconds) would therefore show "We couldn't load your training sessions." This matches the confirmed contract (D2: ISO 8601 with offset; the mock emits `toISOString()`) and TC-14 (malformed payload leads to the generic error). Unknown `status` strings stay tolerated. Revisit only if the real API's date format differs (`api-integration`).

### Residual Gaps (non-blocking)

- **Real-browser verification is still missing:** MSW worker registration, 320 px layout, dark mode, focus rings, modal scrolling on small screens, and screen-reader announcements (F2). Owner: `browser-verify` when available, or a manual `npm run dev` pass.
- **Coverage gaps for `test-generator`:** unknown status rendered in the UI and excluded from specific filters; create from the empty state (AC-5.4); 81-character title typed in the UI (VR-T6); mock `POST 400` shown as the generic form error; background `inert` not asserted (AC-3.6). The malformed-payload UI gap from the first review is now covered by F1's test.
- **No React error boundary (R3):** an architectural note, out of scope.

### Sign-off

**APPROVED.** The Training Sessions workspace meets the requirements, the boundary rules and the static checks. Open items (F2, N1, the casts in the F4 pattern, the coverage gaps and the browser verification) are tracked and do not block approval. Next steps: optional `test-generator` for the coverage gaps, and `browser-verify` (or a manual browser pass) before release.
