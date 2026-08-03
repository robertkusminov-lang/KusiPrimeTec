import React from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { BUSINESS_RULES } from "@/config/businessRules";
import { KATEGORIEN } from "@/data/content";
import { checkZipRadius } from "@/lib/zip";
import { createTicket } from "@/features/apiClient";
import { apiGet } from "@/lib/api";
import { normalizeCustomerType, resolveInvoiceRecipientName } from "@/lib/customer";
import { anfrageartToRequestType } from "@/lib/requestType";
import { toUserMessage } from "@/lib/errors";
import { trackGoogleEvent } from "@/lib/googleTag";
import { TicketWizardPayload } from "@/types/domain";
import { fileToBase64, MAX_UPLOAD_FILES, useUploadState, validateTicketFiles } from "./upload";
import { createTicketSubmissionGuard } from "./submissionGuard";

type WizardState = Omit<TicketWizardPayload, "attachments">;

interface CategoryRule {
  subtitle: string;
  allowed: string[];
  blocked: string[];
  blockPatterns: RegExp[];
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  Einzelauftrag: {
    subtitle: "Für einmalige Einsätze, Kleinreparaturen und technische Themen im Bestand.",
    allowed: [
      "Kleinreparatur",
      "Mängelaufnahme",
      "Terminplanung",
      "Rückfrage Kunde",
    ],
    blocked: [
      "Neuinstallation / Komplettsanierung",
      "Arbeiten an Zähleranlagen oder Hausanschluss",
      "Abnahmen und eigenverantwortliche Errichtung elektrotechnischer Anlagen",
    ],
    blockPatterns: [/neuinstallation/i, /komplettsanierung/i, /zähler/i, /zaehlerschrank/i, /hausanschluss/i, /unterverteilung/i, /netzbetreiber/i],
  },
  Kleinreparatur: {
    subtitle: "Kleinreparaturen im zulässigen Rahmen mit klarer Dokumentation.",
    allowed: [
      "Befestigen / Nachziehen",
      "Austausch einfacher Komponenten",
      "Kleinere Instandhaltung im Bestand",
    ],
    blocked: ["Meisterpflichtige oder fachpflichtige Arbeiten"],
    blockPatterns: [/neuinstallation/i, /abnahme/i, /zähler/i, /hausanschluss/i],
  },
  Mängelaufnahme: {
    subtitle: "Sichtbare Mängel strukturiert aufnehmen, priorisieren und dokumentieren.",
    allowed: [
      "Fotodokumentation",
      "Kurzbeschreibung des Mangels",
      "Empfehlung der nächsten Schritte",
    ],
    blocked: [],
    blockPatterns: [/neuinstallation/i, /zähler/i, /hausanschluss/i],
  },
  Instandhaltung: {
    subtitle: "Laufende Instandhaltung im Bestand mit Fokus auf kleine, planbare Maßnahmen.",
    allowed: [
      "Kleinere Instandhaltung",
      "Materialaufnahme",
      "Nachverfolgung offener Punkte",
    ],
    blocked: ["Komplettsanierungen und Neuinstallationen"],
    blockPatterns: [/neuinstallation/i, /komplettsanierung/i],
  },
  Sichtkontrolle: {
    subtitle: "Sichtkontrollen und kurze technische Rundgänge ohne Messung oder Abnahme.",
    allowed: [
      "Rundgang",
      "Kurze Statusaufnahme",
      "Dokumentation sichtbarer Auffälligkeiten",
    ],
    blocked: [],
    blockPatterns: [],
  },
  "Wartung im Bestand": {
    subtitle: "Planbare Wartungs- und Bestandsarbeiten im laufenden Betrieb.",
    allowed: ["Wiederkehrende Kontrolle", "Nacharbeiten", "Dokumentation"],
    blocked: [],
    blockPatterns: [/neuinstallation/i, /abnahme/i],
  },
  "Handwerklich-technischer Allround-Service": {
    subtitle: "Praktische Unterstützung bei kleineren technischen Themen im Bestand.",
    allowed: ["Kleinmaßnahme", "Nachjustierung", "Dokumentation"],
    blocked: ["Meisterpflichtige Facharbeiten"],
    blockPatterns: [/neuinstallation/i, /abnahme/i, /zähler/i, /hausanschluss/i],
  },
  ObjektCheck: {
    subtitle: "Strukturierte Bestandsaufnahme als Vorbereitung für Maßnahmen oder Objektbetreuung.",
    allowed: ["ObjektCheck", "Fotodokumentation", "Empfehlung nächster Schritte"],
    blocked: [],
    blockPatterns: [],
  },
  ObjektBetreuung: {
    subtitle: "Laufende Betreuung für Bestandsobjekte und Gewerbestandorte.",
    allowed: ["Betreuungspaket anfragen", "Rundgänge", "Maßnahmenkoordination"],
    blocked: [],
    blockPatterns: [],
  },
  "Fachfirma erforderlich": {
    subtitle: "Für Themen, die durch qualifizierte Fachfirmen ausgeführt oder koordiniert werden müssen.",
    allowed: ["Koordination Fachfirma", "Vor-Ort-Aufnahme", "Abstimmung"],
    blocked: [],
    blockPatterns: [],
  },
  "Material benötigt": {
    subtitle: "Wenn zunächst Material oder Ersatzteile aufgenommen und abgestimmt werden müssen.",
    allowed: ["Materialaufnahme", "Ersatzteilprüfung", "Folgetermin vorbereiten"],
    blocked: [],
    blockPatterns: [],
  },
  "Rückfrage Kunde": {
    subtitle: "Für Rückfragen, Klärungen und ergänzende Informationen zu einem bestehenden Thema.",
    allowed: ["Klärung", "Nachfrage", "Freigabe abstimmen"],
    blocked: [],
    blockPatterns: [],
  },
  Terminplanung: {
    subtitle: "Wenn vor allem Terminabstimmung oder Einsatzplanung im Vordergrund steht.",
    allowed: ["Terminwunsch", "Verschiebung", "Abstimmung Ansprechpartner"],
    blocked: [],
    blockPatterns: [],
  },
  Dokumentation: {
    subtitle: "Für Berichte, Nachweise, Fotodokumentation und strukturierte Rückmeldungen.",
    allowed: ["Fotodokumentation", "Rapport", "Kurzbericht"],
    blocked: [],
    blockPatterns: [],
  },
  Sonstiges: {
    subtitle: "Allgemeine Anfrage. Wir prüfen die Lage und melden uns mit einer klaren Ersteinschätzung.",
    allowed: ["Allgemeine Prüfung", "Rückmeldung mit Empfehlung"],
    blocked: ["Keine Neuinstallationen oder Abnahmen durch uns."],
    blockPatterns: [/neuinstallation/i, /abnahme/i, /zähler/i, /hausanschluss/i],
  },
};

const steps = [
  "Standortprüfung",
  "Einsatzart",
  "Kategorie",
  "Dringlichkeit",
  "Terminwunsch",
  "Kontakt & Objekt",
  "Beschreibung + Upload",
  "Zusammenfassung",
];

const initialState: WizardState = {
  plz: "",
  ort: "",
  radius_km: 30,
  anfrageart: "direkt_einsatz",
  request_type: "direct",
  subkategorie: CATEGORY_RULES.Einzelauftrag.allowed[0],
  customer_type: "privat",
  ansprechpartner: "",
  kategorie: "Einzelauftrag",
  dringlichkeit: "niedrig",
  terminwunsch: "",
  zeitfenster_von: "",
  zeitfenster_bis: "",
  kunde_name: "",
  kunde_firma: "",
  kunde_email: "",
  kunde_telefon: "",
  objekt_adresse: "",
  objekt_strasse: "",
  objekt_plz: "",
  objekt_ort: "",
  access_notes: "",
  beschreibung: "",
  datenschutz_akzeptiert: false,
  agb_akzeptiert: false,
  haftung_koordination_akzeptiert: false,
};

interface Props {
  initialAnfrageart?: "direkt_einsatz" | "angebot_anfordern";
  profilePrefill?: Partial<WizardState>;
  objectOptions?: Array<{ id: string; name: string; street?: string; zip?: string; city?: string; access_notes?: string }>;
}

interface BookedRange {
  date: string;
  from: string;
  to: string;
}

function required(label: string): string {
  return `${label} *`;
}

function fieldClass(hasError: boolean): string {
  return clsx(
    "premium-input rounded-xl px-3 py-2 text-sm",
    hasError && "border-rose-400/65 shadow-[0_0_0_1px_rgba(244,63,94,0.45)]"
  );
}

function parseAddressMeta(text: string): {
  hasMeta: boolean;
  street: string;
  zip: string;
  city: string;
  cleanedText: string;
} {
  let street = "";
  let zip = "";
  let city = "";
  let hasMeta = false;

  const cleaned = String(text || "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;

      if (/^(meta:|session_id\s*=|outside_service_request\s*=)/i.test(trimmed)) {
        hasMeta = true;
        return false;
      }

      const streetMatch = /^(adresse|straße|strasse)\s*:\s*(.+)$/i.exec(trimmed);
      if (streetMatch) {
        hasMeta = true;
        street = street || streetMatch[2].trim();
        return false;
      }

      const zipMatch = /^plz\s*:\s*(\d{5})$/i.exec(trimmed);
      if (zipMatch) {
        hasMeta = true;
        zip = zip || zipMatch[1];
        return false;
      }

      const cityMatch = /^ort\s*:\s*(.+)$/i.exec(trimmed);
      if (cityMatch) {
        hasMeta = true;
        city = city || cityMatch[1].trim();
        return false;
      }

      return true;
    })
    .join("\n")
    .trim();

  return { hasMeta, street, zip, city, cleanedText: cleaned };
}

function billingDisplayName(customerType: string | undefined, name: string, company: string): string {
  const type = normalizeCustomerType(customerType) || "privat";
  return (
    resolveInvoiceRecipientName({
      customerType: type,
      kundeName: name,
      kundeFirma: company,
    }) || "-"
  );
}

function detectBlockedRequest(category: string, description: string): boolean {
  if (category === "Fachfirma erforderlich") return false;
  const rule = CATEGORY_RULES[category] || CATEGORY_RULES.Sonstiges;
  return rule.blockPatterns.some((pattern) => pattern.test(description));
}

function hhmmToMinutes(value: string, fallback: number): number {
  const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return h * 60 + min;
}

const OPENING_START_MINUTES = hhmmToMinutes(BUSINESS_RULES.openingHours.start, 9 * 60);
const OPENING_END_MINUTES = hhmmToMinutes(BUSINESS_RULES.openingHours.end, 17 * 60);
const SLOT_MINUTES = BUSINESS_RULES.openingHours.slotMinutes;
const BOOKING_MIN_DATE = "2026-04-01";
const BOOKING_MIN_DATE_LABEL = "01.04.2026";

function parseTimeToMinutes(value: string): number {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isHalfHour(value: string): boolean {
  const minutes = parseTimeToMinutes(value);
  if (!Number.isFinite(minutes)) return false;
  return minutes % SLOT_MINUTES === 0;
}

function isWeekday(dateValue: string): boolean {
  const raw = String(dateValue || "").trim();
  if (!raw) return true;
  const dt = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return false;
  const day = dt.getDay();
  return day >= 1 && day <= 5;
}

function isBeforeMinDate(dateValue: string): boolean {
  const raw = String(dateValue || "").trim();
  if (!raw) return false;
  return raw < BOOKING_MIN_DATE;
}

function buildStartOptions(): string[] {
  const out: string[] = [];
  for (let t = OPENING_START_MINUTES; t <= OPENING_END_MINUTES - SLOT_MINUTES; t += SLOT_MINUTES) {
    out.push(minutesToTime(t));
  }
  return out;
}

function buildEndOptions(fromValue: string): string[] {
  const from = parseTimeToMinutes(fromValue);
  if (!Number.isFinite(from)) return [];
  const out: string[] = [];
  for (let t = from + SLOT_MINUTES; t <= OPENING_END_MINUTES; t += SLOT_MINUTES) {
    out.push(minutesToTime(t));
  }
  return out;
}

function isWithinOpeningWindow(fromValue: string, toValue: string): boolean {
  const from = parseTimeToMinutes(fromValue);
  const to = parseTimeToMinutes(toValue);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  if (from < OPENING_START_MINUTES || to > OPENING_END_MINUTES) return false;
  if (from >= to) return false;
  return true;
}

export function BookingWizard({ initialAnfrageart = "direkt_einsatz", profilePrefill, objectOptions = [] }: Props) {
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState<"next" | "prev">("next");
  const [einsatzartChoice, setEinsatzartChoice] = React.useState<"direkt_einsatz" | "angebot_anfordern">(
    initialAnfrageart === "angebot_anfordern" ? "angebot_anfordern" : "direkt_einsatz"
  );
  const [form, setForm] = React.useState<WizardState>({
    ...initialState,
    anfrageart: initialAnfrageart,
    request_type: anfrageartToRequestType(initialAnfrageart),
  });
  const [attempted, setAttempted] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState<{ ticket_nummer: string } | null>(null);
  const [otherTimeRequest, setOtherTimeRequest] = React.useState(false);
  const [otherTimeText, setOtherTimeText] = React.useState("");
  const [bookedRanges, setBookedRanges] = React.useState<BookedRange[]>([]);
  const [bookedRangesWarning, setBookedRangesWarning] = React.useState("");
  const [prefillApplied, setPrefillApplied] = React.useState(false);
  const [selectedObjectId, setSelectedObjectId] = React.useState("");
  const submissionGuardRef = React.useRef(createTicketSubmissionGuard());
  const { files, setFiles, removeFile } = useUploadState();
  const emailFromAccount = String(profilePrefill?.kunde_email || "").trim();

  React.useEffect(() => {
    if (!profilePrefill || prefillApplied) return;
    const hasValues = Object.values(profilePrefill).some((value) => String(value ?? "").trim() !== "");
    if (!hasValues) return;
    setForm((prev) => ({
      ...prev,
      ...profilePrefill,
      anfrageart: prev.anfrageart,
      request_type: prev.request_type,
    }));
    setPrefillApplied(true);
  }, [prefillApplied, profilePrefill]);

  React.useEffect(() => {
    if (!selectedObjectId) return;
    const selected = objectOptions.find((obj) => obj.id === selectedObjectId);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      objekt_strasse: selected.street || prev.objekt_strasse,
      plz: selected.zip || prev.plz,
      ort: selected.city || prev.ort,
      access_notes: selected.access_notes || prev.access_notes,
    }));
  }, [objectOptions, selectedObjectId]);

  const zipCheck = checkZipRadius(form.plz, BUSINESS_RULES.serviceArea.radiusKm);
  const zipFormatOk = /^\d{5}$/.test(form.plz.trim());
  const progress = ((step + 1) / steps.length) * 100;
  const currentRule = CATEGORY_RULES[form.kategorie] || CATEGORY_RULES.Sonstiges;
  const descriptionMeta = parseAddressMeta(form.beschreibung);
  const allLegalAccepted =
    form.datenschutz_akzeptiert && form.agb_akzeptiert && form.haftung_koordination_akzeptiert;
  const baseStartOptions = React.useMemo(() => buildStartOptions(), []);
  const bookedRangesByDate = React.useMemo(() => {
    const map = new Map<string, { from: string; to: string; fromMinutes: number; toMinutes: number }[]>();
    for (const range of bookedRanges) {
      const date = String(range.date || "").trim();
      const from = String(range.from || "").trim();
      const to = String(range.to || "").trim();
      const fromMinutes = parseTimeToMinutes(from);
      const toMinutes = parseTimeToMinutes(to);
      if (!date || !Number.isFinite(fromMinutes) || !Number.isFinite(toMinutes) || fromMinutes >= toMinutes) continue;
      const list = map.get(date) || [];
      list.push({ from, to, fromMinutes, toMinutes });
      map.set(date, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => a.fromMinutes - b.fromMinutes || a.toMinutes - b.toMinutes);
      map.set(key, list);
    }
    return map;
  }, [bookedRanges]);

  const hasBlockedOverlap = React.useCallback(
    (date: string, fromValue: string, toValue: string): boolean => {
      const fromMinutes = parseTimeToMinutes(fromValue);
      const toMinutes = parseTimeToMinutes(toValue);
      if (!Number.isFinite(fromMinutes) || !Number.isFinite(toMinutes) || fromMinutes >= toMinutes) return false;
      const ranges = bookedRangesByDate.get(String(date || "").trim()) || [];
      return ranges.some((range) => fromMinutes < range.toMinutes && toMinutes > range.fromMinutes);
    },
    [bookedRangesByDate]
  );

  const isStartOptionBlocked = React.useCallback(
    (date: string, fromValue: string): boolean => {
      const endCandidates = buildEndOptions(fromValue);
      if (!endCandidates.length) return true;
      return !endCandidates.some((toValue) => !hasBlockedOverlap(date, fromValue, toValue));
    },
    [hasBlockedOverlap]
  );

  const startOptions = React.useMemo(() => {
    if (!form.terminwunsch) return baseStartOptions;
    return baseStartOptions.filter((slot) => !isStartOptionBlocked(form.terminwunsch, slot));
  }, [baseStartOptions, form.terminwunsch, isStartOptionBlocked]);

  const endOptionsAll = React.useMemo(() => buildEndOptions(form.zeitfenster_von), [form.zeitfenster_von]);
  const endOptions = React.useMemo(() => {
    if (!form.terminwunsch || !form.zeitfenster_von) return endOptionsAll;
    return endOptionsAll.filter((slot) => !hasBlockedOverlap(form.terminwunsch, form.zeitfenster_von, slot));
  }, [endOptionsAll, form.terminwunsch, form.zeitfenster_von, hasBlockedOverlap]);

  const bookedRangesForSelectedDate = React.useMemo(() => {
    if (!form.terminwunsch) return [];
    return bookedRangesByDate.get(form.terminwunsch) || [];
  }, [bookedRangesByDate, form.terminwunsch]);

  React.useEffect(() => {
    if (!form.subkategorie || !currentRule.allowed.includes(form.subkategorie)) {
      setForm((prev) => ({ ...prev, subkategorie: currentRule.allowed[0] || "" }));
    }
  }, [currentRule.allowed, form.subkategorie]);

  React.useEffect(() => {
    if (!form.ort && zipCheck.city) {
      setForm((prev) => ({ ...prev, ort: zipCheck.city }));
    }
  }, [form.ort, zipCheck.city]);

  React.useEffect(() => {
    if (!form.zeitfenster_von) return;
    if (!startOptions.includes(form.zeitfenster_von)) {
      setForm((prev) => ({ ...prev, zeitfenster_von: "", zeitfenster_bis: "" }));
    }
  }, [form.zeitfenster_von, startOptions]);

  React.useEffect(() => {
    if (!form.zeitfenster_bis) return;
    if (!endOptions.includes(form.zeitfenster_bis)) {
      setForm((prev) => ({ ...prev, zeitfenster_bis: "" }));
    }
  }, [endOptions, form.zeitfenster_bis]);

  React.useEffect(() => {
    if (!form.terminwunsch || !form.zeitfenster_von || !form.zeitfenster_bis) return;
    if (hasBlockedOverlap(form.terminwunsch, form.zeitfenster_von, form.zeitfenster_bis)) {
      setForm((prev) => ({ ...prev, zeitfenster_von: "", zeitfenster_bis: "" }));
    }
  }, [form.terminwunsch, form.zeitfenster_von, form.zeitfenster_bis, hasBlockedOverlap]);

  React.useEffect(() => {
    let stop = false;
    setBookedRangesWarning("");
    apiGet<{ booked_ranges?: { date?: string; from?: string; to?: string }[] }>("booking-unavailable-dates")
      .then((res) => {
        if (stop) return;
        const unique = new Map<string, BookedRange>();
        for (const raw of res.booked_ranges || []) {
          const date = String(raw?.date || "").trim();
          const from = String(raw?.from || "").trim();
          const to = String(raw?.to || "").trim();
          if (!date || !from || !to) continue;
          const fromMinutes = parseTimeToMinutes(from);
          const toMinutes = parseTimeToMinutes(to);
          if (!Number.isFinite(fromMinutes) || !Number.isFinite(toMinutes) || fromMinutes >= toMinutes) continue;
          unique.set(`${date}|${from}|${to}`, { date, from, to });
        }
        setBookedRanges([...unique.values()]);
      })
      .catch(() => {
        if (stop) return;
        setBookedRanges([]);
        setBookedRangesWarning("Belegte Uhrzeiten konnten gerade nicht geladen werden.");
      });
    return () => {
      stop = true;
    };
  }, []);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "anfrageart") {
        next.request_type = anfrageartToRequestType(value);
      }
      return next;
    });
    setError("");
  }

  function handleDateChange(value: string) {
    const next = String(value || "").trim();
    if (!next) {
      update("terminwunsch", "");
      return;
    }
    if (isBeforeMinDate(next)) {
      setError(`Wunschdatum ist erst ab ${BOOKING_MIN_DATE_LABEL} verfügbar.`);
      return;
    }
    if (BUSINESS_RULES.openingHours.weekdaysOnly && !isWeekday(next)) {
      setError("Wunschdatum ist nur Montag bis Freitag verfügbar.");
      return;
    }
    update("terminwunsch", next);
  }

  function validate(currentStep = step): string {
    if (currentStep === 0) {
      if (!zipFormatOk) return "Bitte eine gültige PLZ eingeben.";
    }

    if (currentStep === 4) {
      if (form.terminwunsch && isBeforeMinDate(form.terminwunsch)) {
        return `Wunschdatum ist erst ab ${BOOKING_MIN_DATE_LABEL} verfügbar.`;
      }
      const from = String(form.zeitfenster_von || "").trim();
      const to = String(form.zeitfenster_bis || "").trim();
      if ((from && !to) || (!from && to)) return "Bitte beide Uhrzeiten angeben (von und bis).";
      if (BUSINESS_RULES.openingHours.weekdaysOnly && !isWeekday(form.terminwunsch)) {
        return "Wunschdatum ist nur Montag bis Freitag verfügbar.";
      }
      if (from && to) {
        if (!isHalfHour(from) || !isHalfHour(to)) return "Bitte Uhrzeiten nur in 30-Minuten-Schritten angeben.";
        if (!isWithinOpeningWindow(from, to)) {
          return `Zeitfenster muss innerhalb der Öffnungszeiten ${BUSINESS_RULES.openingHours.start}-${BUSINESS_RULES.openingHours.end} liegen.`;
        }
        if (form.terminwunsch && hasBlockedOverlap(form.terminwunsch, from, to)) {
          return "Dieses Zeitfenster ist bereits vergeben. Bitte andere Uhrzeit wählen.";
        }
      }
    }

    if (currentStep === 5) {
      if (!form.kunde_name.trim()) return "Name ist erforderlich.";
      if (normalizeCustomerType(form.customer_type) === "firma" && !form.kunde_firma.trim()) {
        return "Bei Kundentyp Firma ist die Firma erforderlich.";
      }
      if (!form.kunde_email.trim() && !form.kunde_telefon.trim()) return "Mindestens E-Mail oder Telefon ist erforderlich.";
      if (!form.objekt_strasse?.trim()) return "Straße und Hausnummer sind erforderlich.";
      if (!form.plz.trim()) return "PLZ ist erforderlich.";
      if (!form.ort.trim()) return "Ort ist erforderlich.";
    }

    if (currentStep === 6) {
      if (!form.beschreibung.trim()) return "Bitte Beschreibung erfassen.";
      if (!descriptionMeta.cleanedText.trim()) return "Bitte Beschreibung ohne Meta-/Adressangaben erfassen.";
    }

    if (currentStep === 7) {
      if (!form.datenschutz_akzeptiert) return "Bitte Datenschutz bestätigen.";
      if (!form.agb_akzeptiert) return "Bitte AGB bestätigen.";
      if (!form.haftung_koordination_akzeptiert) return "Bitte Haftung Projektkoordination bestätigen.";
    }

    return "";
  }

  function next() {
    setAttempted(true);
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setDirection("next");
    setError("");
    setAttempted(false);
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function prev() {
    setDirection("prev");
    setError("");
    setAttempted(false);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit() {
    setAttempted(true);
    const msg = validate(7);
    if (msg) {
      setError(msg);
      return;
    }

    const requiredEmail = String(form.kunde_email || "").trim();
    const requiredPhone = String(form.kunde_telefon || "").trim();
    if (!requiredEmail && !requiredPhone) {
      setError("Mindestens E-Mail oder Telefon ist erforderlich.");
      return;
    }

    const cleanedDescription = descriptionMeta.cleanedText;
    const resolvedStreet = (form.objekt_strasse || "").trim() || descriptionMeta.street;
    const resolvedZip = form.plz.trim() || descriptionMeta.zip;
    const resolvedCity = form.ort.trim() || descriptionMeta.city || zipCheck.city;

    if (!resolvedStreet || !resolvedZip || !resolvedCity) {
      setError("Objektdaten unvollständig. Bitte Straße, PLZ und Ort vollständig eintragen.");
      return;
    }

    if (detectBlockedRequest(form.kategorie, cleanedDescription)) {
      update("kategorie", "Fachfirma erforderlich");
      update("subkategorie", CATEGORY_RULES["Fachfirma erforderlich"].allowed[0]);
      setError(
        "Diese Anfrage enthält Tätigkeiten außerhalb unseres direkten Leistungsumfangs. Die Anfrage wurde auf 'Fachfirma erforderlich' umgestellt."
      );
      return;
    }

    const idempotencyKey = submissionGuardRef.current.begin();
    if (!idempotencyKey) return;
    let submitted = false;
    setLoading(true);
    setError("");
    try {
      const attachments = await Promise.all(files.map((file) => fileToBase64(file)));
      const specialTimeText = otherTimeRequest ? String(otherTimeText || "").trim() : "";
      const mergedAccessNotes = [String(form.access_notes || "").trim(), specialTimeText ? `Sonderzeitwunsch: ${specialTimeText}` : ""]
        .filter(Boolean)
        .join(" | ");
      const payload: TicketWizardPayload = {
        ...form,
        idempotency_key: idempotencyKey,
        object_id: selectedObjectId || undefined,
        request_type: anfrageartToRequestType(form.anfrageart),
        plz: resolvedZip,
        ort: resolvedCity,
        objekt_strasse: resolvedStreet,
        objekt_plz: resolvedZip,
        objekt_ort: resolvedCity,
        objekt_adresse: `${resolvedStreet}, ${resolvedZip} ${resolvedCity}`,
        access_notes: mergedAccessNotes,
        beschreibung: cleanedDescription,
        distanz_km: zipCheck.distanceKm,
        outside_service_area: !zipCheck.ok,
        attachments,
      };
      const result = await createTicket(payload);
      submitted = true;
      setSuccess({ ticket_nummer: result.ticket_nummer });
      trackGoogleEvent("lead_form_submit", {
        form_type: "ticket_request",
        request_type: anfrageartToRequestType(form.anfrageart),
      });
      setForm({
        ...initialState,
        anfrageart: initialAnfrageart,
        request_type: anfrageartToRequestType(initialAnfrageart),
      });
      setOtherTimeRequest(false);
      setOtherTimeText("");
      setFiles([]);
      setStep(0);
      setAttempted(false);
    } catch (err) {
      setError(toUserMessage(err, "Ticket konnte nicht erstellt werden."));
    } finally {
      setLoading(false);
      submissionGuardRef.current.finish(submitted);
    }
  }

  const showZipError = attempted && step === 0 && !zipFormatOk;
  const showNameError = attempted && step === 5 && !form.kunde_name.trim();
  const showCompanyError =
    attempted &&
    step === 5 &&
    normalizeCustomerType(form.customer_type) === "firma" &&
    !form.kunde_firma.trim();
  const showMailError = attempted && step === 5 && !form.kunde_email.trim() && !form.kunde_telefon.trim();
  const showPhoneError = attempted && step === 5 && !form.kunde_email.trim() && !form.kunde_telefon.trim();
  const showStreetError = attempted && step === 5 && !form.objekt_strasse?.trim();
  const showCityError = attempted && step === 5 && !form.ort.trim();
  const showDescriptionError = attempted && step === 6 && !descriptionMeta.cleanedText.trim();

  return (
    <GlassCard className="p-4 md:p-6">
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-electric-300/30 bg-slate-900/45 px-4 py-3">
            <img
              src="/kpt-logo.png"
              alt="KusiPrimeTec Logo"
              className="h-24 w-24 rounded-xl border border-electric-300/35 bg-slate-950/60 p-1 object-contain"
              loading="eager"
            />
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">KusiPrimeTec</p>
          </div>
        </div>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">
              Schritt {step + 1} von {steps.length}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-electric-300/35 bg-electric-400/10 px-3 py-1 text-xs text-electric-300">
              Rückmeldung in {BUSINESS_RULES.response.hours}h
            </div>
          </div>
          <p className="text-sm text-[var(--text-soft)]">{steps[step]}</p>

          <div className="h-2 rounded-full bg-slate-900/80">
            <div
              className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(59,130,246,.95),rgba(56,189,248,.85))] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5 md:grid-cols-8">
            {steps.map((name, idx) => (
              <span
                key={name}
                className={clsx("h-1.5 rounded-full transition-all duration-200", idx <= step ? "bg-electric-300/90" : "bg-slate-700/80")}
              />
            ))}
          </div>
        </header>

        <div className={clsx("wizard-step", direction === "prev" && "wizard-step-back")} key={step}>
          {step === 0 ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm">
                <span>{required("PLZ")}</span>
                <input
                  maxLength={5}
                  className={fieldClass(showZipError)}
                  value={form.plz}
                  onChange={(e) => update("plz", e.target.value.replace(/\D/g, "").slice(0, 5))}
                />
              </label>
              <p className="text-xs text-[var(--text-soft)]">Radiusprüfung auf {BUSINESS_RULES.serviceArea.text}.</p>
              {form.plz ? (
                <p className={clsx("text-sm", zipCheck.ok ? "text-emerald-300" : "text-amber-300")}>
                  {zipCheck.ok ? `Im Einsatzgebiet (${zipCheck.city}, ${zipCheck.distanceKm} km).` : "Außerhalb – Anfrage optional möglich."}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={clsx(
                  "premium-card p-3 text-left transition-all duration-150",
                  einsatzartChoice === "direkt_einsatz"
                    ? "border-electric-300/60 bg-slate-900/70 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                    : "border-[var(--line)]"
                )}
                onClick={() => {
                  setEinsatzartChoice("direkt_einsatz");
                  update("anfrageart", "direkt_einsatz");
                }}
              >
                <p className="text-sm font-semibold text-white">
                  Direkt Einsatz {einsatzartChoice === "direkt_einsatz" ? "· Ausgewählt" : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Schnelle Terminplanung.</p>
              </button>
              <button
                type="button"
                className={clsx(
                  "premium-card p-3 text-left transition-all duration-150",
                  einsatzartChoice === "angebot_anfordern"
                    ? "border-electric-300/60 bg-slate-900/70 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                    : "border-[var(--line)]"
                )}
                onClick={() => {
                  setEinsatzartChoice("angebot_anfordern");
                  update("anfrageart", "angebot_anfordern");
                }}
              >
                <p className="text-sm font-semibold text-white">
                  Angebot fordern {einsatzartChoice === "angebot_anfordern" ? "· Ausgewählt" : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Unverbindliche Angebotsanfrage vor Ort.</p>
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span>{required("Kategorie")}</span>
                <select className={fieldClass(false)} value={form.kategorie} onChange={(e) => update("kategorie", e.target.value)}>
                  {KATEGORIEN.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <article className="rounded-xl border border-[var(--line)] bg-slate-900/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-electric-300">Kategorie-Hinweis</p>
                <p className="mt-1 text-sm text-[var(--text-main)]">{currentRule.subtitle}</p>
              </article>

              <label className="grid gap-1">
                <span>{required("Leistungsbereich")}</span>
                <select className={fieldClass(false)} value={form.subkategorie || ""} onChange={(e) => update("subkategorie", e.target.value)}>
                  {currentRule.allowed.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 md:grid-cols-2">
                <article className="rounded-xl border border-emerald-300/30 bg-emerald-400/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Direkt möglich</p>
                  <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
                    {currentRule.allowed.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-xl border border-rose-300/30 bg-rose-400/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">Nicht direkt durch uns</p>
                  <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
                    {currentRule.blocked.length ? (
                      currentRule.blocked.map((item) => <li key={item}>✗ {item}</li>)
                    ) : (
                      <li>Keine zusätzlichen Einschränkungen in dieser Kategorie.</li>
                    )}
                  </ul>
                </article>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <label className="grid gap-1 text-sm">
              <span>{required("Dringlichkeit")}</span>
              <select
                className={fieldClass(false)}
                value={form.dringlichkeit}
                onChange={(e) => update("dringlichkeit", e.target.value as WizardState["dringlichkeit"])}
              >
                <option value="niedrig">Normal</option>
                <option value="mittel">Zeitnah</option>
                <option value="hoch">Dringend</option>
                <option value="kritisch">Sicherheitsrelevant / bitte prüfen</option>
              </select>
            </label>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span>Wunschdatum (optional)</span>
                <input
                  type="date"
                  min={BOOKING_MIN_DATE}
                  className={fieldClass(false)}
                  value={form.terminwunsch}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </label>
              <p className="text-xs text-[var(--text-soft)] sm:col-span-3">
                Termine werden erst ab {BOOKING_MIN_DATE_LABEL} angenommen.
              </p>
              {bookedRangesForSelectedDate.length > 0 ? (
                <p className="text-xs text-amber-300 sm:col-span-3">
                  Bereits belegte Uhrzeiten an diesem Tag: {bookedRangesForSelectedDate.map((range) => `${range.from}-${range.to}`).join(", ")}
                </p>
              ) : null}
              {bookedRangesWarning ? <p className="text-xs text-amber-300 sm:col-span-3">{bookedRangesWarning}</p> : null}
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span className="text-xs text-[var(--text-soft)]">
                  Öffnungszeiten: Montag bis Freitag, {BUSINESS_RULES.openingHours.start}-{BUSINESS_RULES.openingHours.end} Uhr. Zeitfenster in {BUSINESS_RULES.openingHours.slotMinutes}-Minuten-Schritten.
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                <span>Zeit von</span>
                <select
                  className={fieldClass(false)}
                  value={form.zeitfenster_von}
                  onChange={(e) => update("zeitfenster_von", e.target.value)}
                >
                  <option value="">Bitte wählen</option>
                  {baseStartOptions.map((slot) => {
                    const isBlocked = !!form.terminwunsch && !startOptions.includes(slot);
                    return (
                      <option key={slot} value={slot} disabled={isBlocked}>
                        {slot}{isBlocked ? " (belegt)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>Zeit bis</span>
                <select
                  className={fieldClass(false)}
                  value={form.zeitfenster_bis}
                  onChange={(e) => update("zeitfenster_bis", e.target.value)}
                  disabled={!form.zeitfenster_von}
                >
                  <option value="">Bitte wählen</option>
                  {endOptionsAll.map((slot) => {
                    const isBlocked =
                      !!form.terminwunsch &&
                      !!form.zeitfenster_von &&
                      !endOptions.includes(slot);
                    return (
                      <option key={slot} value={slot} disabled={isBlocked}>
                        {slot}{isBlocked ? " (belegt)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="inline-flex items-start gap-2 text-sm sm:col-span-3">
                <input type="checkbox" checked={otherTimeRequest} onChange={(e) => setOtherTimeRequest(e.target.checked)} />
                <span>Andere Uhrzeit auf Anfrage</span>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span>Hinweis zur alternativen Uhrzeit (optional)</span>
                <input
                  className={fieldClass(false)}
                  placeholder="z. B. Samstag früh oder ab 18:00 möglich?"
                  value={otherTimeText}
                  onChange={(e) => setOtherTimeText(e.target.value)}
                  disabled={!otherTimeRequest}
                />
              </label>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {objectOptions.length ? (
                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span>Objektzuordnung (optional)</span>
                  <select className={fieldClass(false)} value={selectedObjectId} onChange={(e) => setSelectedObjectId(e.target.value)}>
                    <option value="">Neues/eigenes Objekt ohne Zuordnung</option>
                    {objectOptions.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name} {obj.city ? `· ${obj.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span>{required("Kundentyp")}</span>
                <select
                  className={fieldClass(false)}
                  value={form.customer_type || "privat"}
                  onChange={(e) => update("customer_type", e.target.value as "privat" | "firma")}
                >
                  <option value="privat">Privat</option>
                  <option value="firma">Firma</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>{required("Name")}</span>
                <input className={fieldClass(showNameError)} value={form.kunde_name} onChange={(e) => update("kunde_name", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Ansprechpartner</span>
                <input className={fieldClass(false)} value={form.ansprechpartner || ""} onChange={(e) => update("ansprechpartner", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{normalizeCustomerType(form.customer_type) === "firma" ? required("Firma") : "Firma"}</span>
                <input className={fieldClass(showCompanyError)} value={form.kunde_firma} onChange={(e) => update("kunde_firma", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{required("E-Mail")}</span>
                <input
                  type="email"
                  className={fieldClass(showMailError)}
                  value={form.kunde_email}
                  onChange={(e) => update("kunde_email", e.target.value)}
                  readOnly={Boolean(emailFromAccount)}
                />
                {emailFromAccount ? <span className="text-xs text-[var(--text-muted)]">Aus Ihrem Kundenkonto übernommen.</span> : null}
              </label>
              <label className="grid gap-1 text-sm">
                <span>{required("Telefon")}</span>
                <input className={fieldClass(showPhoneError)} value={form.kunde_telefon} onChange={(e) => update("kunde_telefon", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>{required("Objekt: Straße + Hausnummer")}</span>
                <input className={fieldClass(showStreetError)} value={form.objekt_strasse || ""} onChange={(e) => update("objekt_strasse", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{required("Objekt-PLZ")}</span>
                <input
                  maxLength={5}
                  className={fieldClass(showZipError)}
                  value={form.plz}
                  onChange={(e) => update("plz", e.target.value.replace(/\D/g, "").slice(0, 5))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{required("Objekt-Ort")}</span>
                <input className={fieldClass(showCityError)} value={form.ort} onChange={(e) => update("ort", e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>Zugangshinweise</span>
                <input className={fieldClass(false)} value={form.access_notes || ""} onChange={(e) => update("access_notes", e.target.value)} />
              </label>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm">
                <span>{required("Anliegen / Problemtext")}</span>
                <textarea
                  className={clsx(fieldClass(showDescriptionError), "min-h-32")}
                  value={form.beschreibung}
                  onChange={(e) => update("beschreibung", e.target.value)}
                />
              </label>
              <p className="text-xs text-[var(--text-soft)]">Bitte hier nur Problemtext eintragen. Adresse/PLZ/Ort gehören in den Objektbereich oben.</p>
              {descriptionMeta.hasMeta ? (
                <p className="text-xs text-amber-300">Adress- oder Meta-Angaben wurden erkannt und beim Senden automatisch aus der Beschreibung entfernt.</p>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span>Upload (JPG, PNG, PDF, max. {MAX_UPLOAD_FILES} Dateien, je 10 MB)</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  className={fieldClass(false)}
                  onChange={(e) => {
                    const validation = validateTicketFiles(Array.from(e.target.files || []));
                    setFiles(validation.files);
                    if (validation.errors.length) {
                      setError(validation.errors[0]);
                    } else {
                      setError("");
                    }
                  }}
                />
              </label>
              {files.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {files.map((file) => (
                    <button key={file.name} type="button" className="btn-secondary-premium rounded-full px-3 py-1 text-xs" onClick={() => removeFile(file.name)}>
                      {file.name} entfernen
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 7 ? (
            <div className="grid gap-2 text-sm">
              <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                Einsatzart: {form.anfrageart === "angebot_anfordern" ? "Angebot fordern" : "Direkt Einsatz"} · Kategorie: {form.kategorie} · Bereich: {form.subkategorie}
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                Kontakt: {form.kunde_name} · {form.kunde_email} · {form.kunde_telefon}
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                Kunde: {billingDisplayName(form.customer_type, form.kunde_name, form.kunde_firma)}
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                Objekt: {form.objekt_strasse}, {form.plz} {form.ort}
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                Zeitfenster: {form.zeitfenster_von || "--:--"} - {form.zeitfenster_bis || "--:--"}
              </div>
              {otherTimeRequest ? (
                <div className="rounded-xl border border-[var(--line)] bg-slate-900/45 p-3 text-[var(--text-main)]">
                  Alternative Uhrzeit (Anfrage): {otherTimeText || "angefragt, Details folgen"}
                </div>
              ) : null}
              <label className="inline-flex items-start gap-2 text-sm">
                <input type="checkbox" checked={form.datenschutz_akzeptiert} onChange={(e) => update("datenschutz_akzeptiert", e.target.checked)} />
                <span>Ich akzeptiere die Datenschutzbestimmungen.</span>
              </label>
              <label className="inline-flex items-start gap-2 text-sm">
                <input type="checkbox" checked={form.agb_akzeptiert} onChange={(e) => update("agb_akzeptiert", e.target.checked)} />
                <span>Ich akzeptiere die AGB.</span>
              </label>
              <label className="inline-flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.haftung_koordination_akzeptiert}
                  onChange={(e) => update("haftung_koordination_akzeptiert", e.target.checked)}
                />
                <span>Ich akzeptiere die Haftungsregelung für Projektkoordination.</span>
              </label>
              <p className="text-xs text-[var(--text-soft)]">Ticketnummer wird sofort generiert.</p>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">Ticket erfolgreich erstellt: {success.ticket_nummer}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-soft)]">Ihre Daten werden vertraulich behandelt.</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={prev} disabled={step === 0 || loading}>
              Zurück
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" onClick={next} disabled={loading}>
                Weiter
              </Button>
            ) : (
              <Button type="button" onClick={() => void submit()} disabled={loading || !allLegalAccepted}>
                {loading ? "Sende..." : "Ticket absenden"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
