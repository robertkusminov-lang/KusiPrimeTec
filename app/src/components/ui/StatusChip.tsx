import clsx from "clsx";
import { TicketStatus } from "@/types/domain";
import { labelStatus } from "@/lib/format";

const tone: Record<TicketStatus, string> = {
  Neu: "border-blue-300/50 bg-blue-400/15",
  Geprueft: "border-indigo-300/45 bg-indigo-400/15",
  Rueckfrage_Kunde: "border-amber-300/50 bg-amber-300/15",
  Termin_geplant: "border-cyan-300/45 bg-cyan-300/15",
  In_Arbeit: "border-sky-300/45 bg-sky-300/15",
  Rapport_erstellt: "border-teal-300/45 bg-teal-300/15",
  Storniert: "border-red-300/50 bg-red-300/15",
};

export function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx("inline-flex rounded-full border px-2.5 py-1 text-xs", tone[status])}>
      {labelStatus(status)}
    </span>
  );
}


