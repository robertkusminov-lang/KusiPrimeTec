import { TicketStatus } from "@/types/domain";

export function eur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function dateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("de-DE");
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${date} \u00b7 ${time}`;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  Neu: "Neu",
  Geprueft: "in Prüfung",
  Rueckfrage_Kunde: "Rückfrage offen",
  Termin_geplant: "Termin geplant",
  In_Arbeit: "in Bearbeitung",
  Rapport_erstellt: "abgeschlossen",
  Storniert: "abgelehnt / nicht passend",
};

const CUSTOMER_STATUS_LABELS: Record<TicketStatus, string> = {
  Neu: "Eingegangen",
  Geprueft: "in Prüfung",
  Rueckfrage_Kunde: "wartet auf Rückmeldung",
  Termin_geplant: "Termin geplant",
  In_Arbeit: "in Bearbeitung",
  Rapport_erstellt: "abgeschlossen",
  Storniert: "abgeschlossen",
};

function cleanText(value: string | null | undefined): string {
  return String(value || "")
    .replace(/ï¿½|�/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTicketNumber(value: string | null | undefined): string {
  const cleaned = cleanText(value);
  const kptMatch = cleaned.match(/KPT[^0-9]*?(\d{8})[^0-9]*?(\d{4})/i);
  if (kptMatch) return `KPT-${kptMatch[1]}-${kptMatch[2]}`;
  return cleaned || "-";
}

export function formatTimeValue(value: string | null | undefined): string {
  const cleaned = cleanText(value);
  const match = cleaned.match(/(\d{1,2})[^0-9]?(\d{2})/);
  if (!match) return cleaned || "--:--";
  const hour = String(Number(match[1])).padStart(2, "0");
  const minute = String(Number(match[2])).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatTimeRange(from: string | null | undefined, to: string | null | undefined): string {
  const start = formatTimeValue(from);
  const end = formatTimeValue(to);
  if (start === "--:--" && end === "--:--") return "-";
  return `${start} – ${end}`;
}

export function labelStatus(status: TicketStatus | string): string {
  return STATUS_LABELS[status as TicketStatus] || cleanText(status) || "-";
}

export function labelCustomerStatus(status: TicketStatus | string): string {
  return CUSTOMER_STATUS_LABELS[status as TicketStatus] || labelStatus(status);
}
