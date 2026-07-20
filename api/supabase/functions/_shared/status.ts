export const STATUS = [
  "Neu",
  "Geprueft",
  "Rueckfrage_Kunde",
  "Termin_geplant",
  "In_Arbeit",
  "Rapport_erstellt",
  "Storniert",
] as const;

export type Status = (typeof STATUS)[number];
export const BUCKETS = ["inbox", "active", "archive"] as const;
export type TicketBucket = (typeof BUCKETS)[number];

export function isOpenStatus(value: string): boolean {
  return !(value === "Rapport_erstellt" || value === "Storniert");
}

function normalizeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function normalizeStatus(value: unknown): Status {
  const raw = String(value || "").trim();
  if (STATUS.includes(raw as Status)) return raw as Status;

  const key = normalizeKey(raw);
  const aliases: Record<string, Status> = {
    neu: "Neu",
    new: "Neu",
    gepruft: "Geprueft",
    geprueft: "Geprueft",
    rueckfrage_kunde: "Rueckfrage_Kunde",
    rueckfrage: "Rueckfrage_Kunde",
    wartet_auf_kunde: "Rueckfrage_Kunde",
    termin_geplant: "Termin_geplant",
    geplant: "Termin_geplant",
    in_arbeit: "In_Arbeit",
    in_bearbeitung: "In_Arbeit",
    rapport_erstellt: "Rapport_erstellt",
    abgeschlossen: "Rapport_erstellt",
    erledigt: "Rapport_erstellt",
    done: "Rapport_erstellt",
    storniert: "Storniert",
    cancelled: "Storniert",
    abgebrochen: "Storniert",
  };
  return aliases[key] || "Neu";
}

export function normalizeBucket(value: unknown): TicketBucket | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "inbox") return "inbox";
  if (raw === "active" || raw === "aktiv") return "active";
  if (raw === "archive" || raw === "archiv") return "archive";
  return null;
}

export function bucketForStatus(status: unknown): TicketBucket {
  const canonical = normalizeStatus(status);
  if (canonical === "Neu") return "inbox";
  if (canonical === "Rapport_erstellt" || canonical === "Storniert") return "archive";
  return "active";
}

export const ALLOWED_STATUS_TRANSITIONS: Record<Status, Status[]> = {
  Neu: ["Geprueft", "Rueckfrage_Kunde", "Storniert"],
  Geprueft: ["Rueckfrage_Kunde", "Termin_geplant", "In_Arbeit", "Storniert"],
  Rueckfrage_Kunde: ["Geprueft", "Termin_geplant", "In_Arbeit", "Storniert"],
  Termin_geplant: ["In_Arbeit", "Rueckfrage_Kunde", "Storniert"],
  In_Arbeit: ["Rapport_erstellt", "Storniert"],
  Rapport_erstellt: [],
  Storniert: [],
};

export function canTransitionStatus(fromStatus: unknown, toStatus: unknown): boolean {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);
  if (from === to) return true;
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}
