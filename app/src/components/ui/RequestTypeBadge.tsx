import clsx from "clsx";
import { anfrageartToRequestType, requestTypeLabel } from "@/lib/requestType";

export function RequestTypeBadge({ value }: { value: unknown }) {
  const type = anfrageartToRequestType(value);
  const isDirect = type === "direct";
  const label = requestTypeLabel(type);
  const icon = isDirect ? "\u26A1" : "\u{1F4C4}";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        isDirect
          ? "border-orange-300/65 bg-orange-400/20 text-orange-100"
          : "border-sky-300/60 bg-sky-400/15 text-sky-100"
      )}
      title={`Anfrageart: ${label}`}
      aria-label={`Anfrageart: ${label}`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
