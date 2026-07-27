import React from "react";
import { Button } from "@/components/ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  subject?: string;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title = "Eintrag endgültig löschen?",
  description = "Diese Aktion kann nicht rückgängig gemacht werden.",
  subject,
  error,
  confirmLabel = "Endgültig löschen",
  cancelLabel = "Abbrechen",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="my-auto w-full max-w-lg rounded-2xl border border-rose-300/30 bg-[#0b1424] p-4 shadow-[0_28px_80px_rgba(2,6,23,0.72)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-300/35 bg-rose-400/10 text-xl font-bold text-rose-200">
            !
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white sm:text-xl">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              {description}
            </p>
          </div>
        </div>

        {subject ? (
          <p className="mt-4 break-words rounded-xl border border-[var(--line)] bg-slate-950/45 px-3 py-3 text-sm font-medium text-slate-100">
            {subject}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-300/35 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-2 sm:grid-cols-2 sm:flex-row-reverse">
          <Button
            type="button"
            variant="danger"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Wird ausgeführt..." : confirmLabel}
          </Button>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
