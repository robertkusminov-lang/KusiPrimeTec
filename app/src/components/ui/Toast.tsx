import clsx from "clsx";

type ToastProps = {
  kind: "ok" | "error";
  text: string;
  className?: string;
};

export function Toast({ kind, text, className }: ToastProps) {
  return (
    <div
      role="status"
      className={clsx(
        "rounded-xl border px-3 py-2 text-sm",
        kind === "ok"
          ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
          : "border-rose-300/45 bg-rose-400/10 text-rose-100",
        className
      )}
    >
      {text}
    </div>
  );
}
