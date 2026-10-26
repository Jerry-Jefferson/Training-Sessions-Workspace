import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  // Blocks Escape and the close button, e.g. while a request is pending.
  closeDisabled?: boolean;
  children: ReactNode;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function Modal({
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Captured once on first render, before focus moves into the dialog.
  const [returnFocusTo] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  );

  // Mount: make the app inert, lock page scroll, focus the first control of the content
  // (not the header close button); unmount: undo and restore focus.
  useEffect(() => {
    const dialog = dialogRef.current;
    const body = bodyRef.current;
    const appRoot = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;

    appRoot?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    const initialFocus = (body ? getFocusable(body)[0] : undefined) ?? dialog;
    initialFocus?.focus();

    return () => {
      appRoot?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      // StrictMode's simulated unmount keeps the dialog in the DOM; moving focus out then
      // would blur the first field and mark it touched. Restore only on a real unmount.
      if (!dialog?.isConnected) {
        returnFocusTo?.focus();
      }
    };
  }, [returnFocusTo]);

  // Listening on the document keeps Escape and the focus trap working even when focus
  // fell back to <body> (e.g. after clicking the backdrop).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (!closeDisabled) {
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusIsInside = active instanceof Node && dialog.contains(active);

      if (event.shiftKey && (active === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, closeDisabled]);

  return createPortal(
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="button button-icon"
            aria-label="Close"
            onClick={onClose}
            disabled={closeDisabled}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {description ? (
          <p id={descriptionId} className="modal-description">
            {description}
          </p>
        ) : null}
        <div ref={bodyRef} className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
