# Trainer Workspace & Training Sessions Management

## Overview
Build a frontend workspace allowing a trainer to view, filter, and create training sessions seamlessly with mock API integration and proper state handling.

---

## Required User Flow
The user must be able to:
1. **Open Workspace**: View training sessions loaded asynchronously from a mock API.
2. **Filter Sessions**: Filter the sessions list by status.
3. **Open Create Form**: Access a dedicated form or modal to input new session details.
4. **Create Session**: Submit a new session with a valid title and future date/time.
5. **View New Session**: Instantly view the newly created session in the visible session list upon successful creation.

---

## Detailed Requirements & Behavior

### 1. Sessions List
* **Session Details**: Display for each session:
  * Title
  * Status
  * Start date and time
* **Filtering**:
  * Provide an **All** option (default/reset filter).
  * Provide **one status filter** control.
* **Loading State**: Show a clear loading indicator/state while data is pending fetching.
* **Error Handling**: Display an understandable, recoverable request-error state if fetching fails (with retry capabilities where applicable).

### 2. Create Session Form & Validation
* **Title Validation**:
  * Mandatory field.
  * Must be trimmed of whitespace.
  * Character length constraint: **3 to 80 characters**.
* **Date & Time Validation**:
  * Mandatory field.
  * Must be strictly a **future date and time** relative to the current timestamp.
* **UX & Submission**:
  * Show useful inline/contextual validation error messages for invalid fields.
  * **Prevent duplicate submission**: Disable submit actions while the request is pending.
  * Automatically append and display the successfully created session in the visible sessions list.

### 3. Mock Data Boundary
* Encapsulate mock data behind an HTTP client or equivalent replaceable request boundary (e.g., API service layer).
* Use the repository's existing mock mechanism. If none exists, MSW (Mock Service Worker) is acceptable.
* **Constraint**: Do not implement an actual backend service.

---

## Testing Requirements
* **Behavior-Level Test**: Include at least one automated behavior/integration-level test covering the core flow (e.g., successful session filtering or creation flow).

---

## Technical Constraints & Guidelines
1. **Repository Standards**: Use the repository's existing framework, package manager, build scripts, and testing stack.
2. **Scope Boundary**: Do not rewrite unrelated code or project configuration.
3. **Feature Scope**: Do not add extra features outside the specified user flow.
4. **Reporting**: Report incomplete behavior honestly instead of claiming unperformed validation checks.