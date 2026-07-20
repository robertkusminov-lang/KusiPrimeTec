export type Status =
  | "Neu"
  | "Geprueft"
  | "Rueckfrage_Kunde"
  | "Termin_geplant"
  | "In_Arbeit"
  | "Angebot_erstellt"
  | "Angebot_gesendet"
  | "Angebot_angenommen"
  | "Rapport_erstellt"
  | "Rechnung_erstellt"
  | "Rechnung_gesendet"
  | "Bezahlt"
  | "Storniert";

export function nextTicketNumber(year: number, seq: number): string {
  return `KPT-${year}-${String(seq).padStart(4, "0")}`;
}

export function ensureStatusTransition(current: Status, next: Status): boolean {
  const order: Status[] = [
    "Neu",
    "Geprueft",
    "Rueckfrage_Kunde",
    "Termin_geplant",
    "In_Arbeit",
    "Angebot_erstellt",
    "Angebot_gesendet",
    "Angebot_angenommen",
    "Rapport_erstellt",
    "Rechnung_erstellt",
    "Rechnung_gesendet",
    "Bezahlt",
    "Storniert",
  ];
  if (next === "Storniert") return true;
  return order.indexOf(next) >= order.indexOf(current);
}

export function nextDocumentNumber(prefix: "ANG" | "RAP" | "RE", year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function assignInboundMessageToTicket(subject: string): string | null {
  const hit = String(subject).match(/KPT-\d{4}-\d{4}/i);
  return hit ? hit[0].toUpperCase() : null;
}


