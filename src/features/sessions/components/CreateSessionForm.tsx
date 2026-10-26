import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { createSession } from "../api/sessionsApi";
import {
  createSessionSchema,
  type CreateSessionFormValues,
  type CreateSessionInput,
  type Session,
} from "../schemas";

const CREATE_FAILED_MESSAGE = "Could not create the session. Please try again.";

interface CreateSessionFormProps {
  onCreated: (session: Session) => void;
  onCancel: () => void;
  // Lets the surrounding modal block closing while the request is in flight.
  onPendingChange: (pending: boolean) => void;
}

export function CreateSessionForm({
  onCreated,
  onCancel,
  onPendingChange,
}: CreateSessionFormProps) {
  const titleId = useId();
  const startsAtId = useId();
  const titleErrorId = useId();
  const startsAtErrorId = useId();
  const formErrorId = useId();

  // Synchronous guard: `isSubmitting` only updates after a re-render, and every extra
  // `handleSubmit` call would reset it to false while the first request is still pending.
  const isSubmittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CreateSessionFormValues, unknown, CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { title: "", startsAt: "" },
  });

  const submitValid = handleSubmit(async (input) => {
    clearErrors("root.server");
    onPendingChange(true);
    try {
      const session = await createSession(input);
      onCreated(session);
    } catch {
      // Fields stay valid and keep their values; only a form-level error is shown.
      setError("root.server", { type: "server", message: CREATE_FAILED_MESSAGE });
    } finally {
      onPendingChange(false);
    }
  });

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    void submitValid(event).finally(() => {
      isSubmittingRef.current = false;
    });
  }

  const titleError = errors.title?.message;
  const startsAtError = errors.startsAt?.message;
  const formError = errors.root?.server?.message;

  return (
    <form
      className="create-form"
      noValidate
      onSubmit={handleFormSubmit}
      aria-describedby={formError ? formErrorId : undefined}
    >
      {formError ? (
        <p id={formErrorId} role="alert" className="form-error">
          {formError}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          type="text"
          className="input"
          autoComplete="off"
          readOnly={isSubmitting}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? titleErrorId : undefined}
          {...register("title")}
        />
        {titleError ? (
          <p id={titleErrorId} className="field-error">
            {titleError}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={startsAtId}>Start date and time</label>
        <input
          id={startsAtId}
          type="datetime-local"
          className="input"
          readOnly={isSubmitting}
          aria-invalid={startsAtError ? true : undefined}
          aria-describedby={startsAtError ? startsAtErrorId : undefined}
          {...register("startsAt")}
        />
        {startsAtError ? (
          <p id={startsAtErrorId} className="field-error">
            {startsAtError}
          </p>
        ) : null}
      </div>

      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Save session"}
        </button>
      </div>
    </form>
  );
}
