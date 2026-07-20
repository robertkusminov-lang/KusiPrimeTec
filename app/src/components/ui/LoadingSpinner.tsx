import clsx from "clsx";

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

export function LoadingSpinner({ label = "Lädt...", className }: LoadingSpinnerProps) {
  return (
    <div className={clsx("flex items-center gap-2 text-sm text-[var(--text-soft)]", className)} role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-electric-300/35 border-t-electric-300" />
      <span>{label}</span>
    </div>
  );
}
