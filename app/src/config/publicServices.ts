export const INQUIRY_SELECTIONS = [
  "hausmeisterservice",
  "stoerungsservice",
  "basis",
  "business",
  "pro",
  "priority",
] as const;

export type InquirySelection = (typeof INQUIRY_SELECTIONS)[number];

export type PublicService = {
  id: Extract<InquirySelection, "hausmeisterservice" | "stoerungsservice">;
  name: string;
  priceEur: number;
  description: string;
  features: readonly string[];
  cta: string;
};

export type CarePackage = {
  id: Extract<InquirySelection, "basis" | "business" | "pro" | "priority">;
  name: string;
  priceEur: number;
  hours: number;
  objects: string;
  visits: string;
  reactionReserve: string;
  shortNoticeVisit: string;
  reports: string;
  monthlyOverview: string;
  account: string;
  followUp: string;
  transfer: string;
  coordination: string;
  travel: string;
  badge?: string;
  audience: string;
  features: readonly string[];
  cta: string;
};

export const HOUSEMASTER_SERVICE_HOURLY_EUR = 64.99;
export const TECHNICAL_SERVICE_HOURLY_EUR = 79;

export const PUBLIC_PRICING = {
  serviceCallFlatEur: 39,
  billingNotice:
    "Je Einsatz gilt eine Mindestberechnung von einer Arbeitsstunde. Anschließend erfolgt die Abrechnung transparent in 15-Minuten-Einheiten.",
  taxNotice:
    "Alle Preise in EUR. Gemäß § 19 UStG wird derzeit keine Umsatzsteuer ausgewiesen.",
  excludedCosts:
    "Material, Ersatzteile, Fremdleistungen, Mietgeräte, Hebetechnik und Entsorgung sind nicht enthalten, sofern sie nicht ausdrücklich als enthalten ausgewiesen sind.",
  travelNotice:
    "Für Einzelaufträge gilt die bestehende Einsatzpauschale von 39,00 €. Für die in Betreuungspaketen enthaltenen planmäßigen Termine wird keine zusätzliche Anfahrtspauschale berechnet. Weitere separate Termine werden vorab abgestimmt und können der öffentlich ausgewiesenen Einsatzpauschale unterliegen.",
  additionalCareHourEur: HOUSEMASTER_SERVICE_HOURLY_EUR,
  additionalHoursNotice:
    "Zusätzliche Betreuungsstunden außerhalb des verfügbaren Monats- und Übertragskontingents werden nach vorheriger Abstimmung und Freigabe mit 64,99 € pro Stunde berechnet. Die Abrechnung erfolgt transparent in 15-Minuten-Einheiten.",
  additionalHoursLimits:
    "Die Ausführung erfolgt nach verfügbarer Kapazität. Zusatzstunden enthalten keine garantierte Sofortausführung, Rufbereitschaft, keinen 24-Stunden-Service und keine garantierte Wiederherstellungszeit.",
} as const;

export const PUBLIC_SERVICES: readonly PublicService[] = [
  {
    id: "hausmeisterservice",
    name: "Objekt- & Hausmeisterservice",
    priceEur: HOUSEMASTER_SERVICE_HOURLY_EUR,
    description:
      "Zuverlässige Unterstützung bei laufenden Objektkontrollen, kleineren Instandhaltungsarbeiten, geeigneten Kleinreparaturen und organisatorischen Aufgaben rund um die Immobilie. Auffälligkeiten und ausgeführte Leistungen werden nachvollziehbar dokumentiert.",
    features: [
      "Regelmäßige Kontrollgänge und Sichtkontrollen",
      "Aufnahme sichtbarer Mängel und allgemeiner Objektzustände",
      "Einfache Funktionskontrollen und geeignete Kleinreparaturen",
      "Kleinere Montage-, Befestigungs- und Einstellarbeiten",
      "Material- und Maßnahmenaufnahme",
      "Digitale Dokumentation und Nachverfolgung größerer Mängel",
      "Vorbereitung externer Fachleistungen",
    ],
    cta: "Hausmeisterservice unverbindlich anfragen",
  },
  {
    id: "stoerungsservice",
    name: "Technischer Störungsservice",
    priceEur: TECHNICAL_SERVICE_HOURLY_EUR,
    description:
      "Technische Erstaufnahme, systematische Fehlereingrenzung und nachvollziehbare Dokumentation bei Störungen und Mängeln im Bestand. Geeignete Kleinmaßnahmen werden im zulässigen Leistungsrahmen direkt ausgeführt. Weiterführende Fachleistungen werden vorbereitet oder koordiniert.",
    features: [
      "Technische Erstaufnahme und strukturierte Störungsaufnahme",
      "Erste Fehlereingrenzung und Bestandskontrolle",
      "Funktionskontrollen und geeignete technische Kleinreparaturen",
      "Dokumentation des Zustands",
      "Material- und Maßnahmenplanung",
      "Vorbereitung und Koordination geeigneter Fachunternehmen",
    ],
    cta: "Störungsservice unverbindlich anfragen",
  },
] as const;

export const CARE_PACKAGES: readonly CarePackage[] = [
  {
    id: "basis",
    name: "Objekt Basis",
    priceEur: 399,
    hours: 5,
    objects: "1 definiertes Objekt",
    visits: "Bis zu 1 Termin / Monat",
    reactionReserve: "Nicht enthalten",
    shortNoticeVisit: "Nicht enthalten",
    reports: "Digitaler Einsatzrapport",
    monthlyOverview: "Material- und Maßnahmenaufnahme",
    account: "Nicht enthalten",
    followUp: "Im Rahmen des Termins",
    transfer: "Keine Übertragung",
    coordination: "Vorbereitung bei Bedarf",
    travel: "Enthaltener Termin ohne Zusatzpauschale",
    audience: "Der strukturierte Einstieg für ein kleineres Bestands- oder Gewerbeobjekt.",
    features: [
      "5 Stunden monatliches Betreuungskontingent",
      "1 definiertes Objekt",
      "Bis zu 1 planmäßiger Vor-Ort-Termin pro Monat",
      "Kontrollgang und Sichtkontrolle",
      "Mängelaufnahme und geeignete Kleinreparaturen",
      "Digitaler Einsatzrapport",
      "Material- und Maßnahmenaufnahme",
      "Keine zusätzliche Anfahrtspauschale für den enthaltenen Termin",
    ],
    cta: "Basis unverbindlich anfragen",
  },
  {
    id: "business",
    name: "Objekt Business",
    priceEur: 699,
    hours: 10,
    objects: "Bis zu 2 definierte Objekte",
    visits: "Bis zu 2 Termine / Monat",
    reactionReserve: "Nicht enthalten",
    shortNoticeVisit: "Nicht enthalten",
    reports: "Digitale Einsatzrapporte",
    monthlyOverview: "Monatliche Maßnahmenübersicht",
    account: "Nicht enthalten",
    followUp: "Nachverfolgung offener Punkte",
    transfer: "Keine Übertragung",
    coordination: "Vorbereitung bei Bedarf",
    travel: "Enthaltene Termine ohne Zusatzpauschale",
    audience: "Für regelmäßig betreute Standorte mit wiederkehrenden technischen Themen.",
    features: [
      "10 Stunden monatliches Betreuungskontingent",
      "Bis zu 2 definierte Objekte",
      "Bis zu 2 planmäßige Vor-Ort-Termine pro Monat",
      "Technische Kontrollgänge sowie Sicht- und Funktionskontrollen",
      "Störungsaufnahme und geeignete Kleinreparaturen",
      "Digitale Einsatzrapporte",
      "Nachverfolgung offener Punkte",
      "Monatliche Maßnahmenübersicht",
      "Keine zusätzliche Anfahrtspauschale für enthaltene Termine",
    ],
    cta: "Business unverbindlich anfragen",
  },
  {
    id: "pro",
    name: "Objekt Pro",
    priceEur: 999,
    hours: 15,
    objects: "Bis zu 3 definierte Objekte",
    visits: "Bis zu 3 Termine / Monat",
    reactionReserve: "Bis zu 2 Stunden",
    shortNoticeVisit: "Nach Verfügbarkeit",
    reports: "Digitale Einsatzrapporte",
    monthlyOverview: "Kontingent- und Maßnahmenübersicht",
    account: "Digitales Standort- und Leistungskonto",
    followUp: "Nachverfolgung offener Maßnahmen",
    transfer: "Begrenzt in 1 Folgemonat",
    coordination: "Vorbereitung und Koordination",
    travel: "Enthaltene Termine ohne Zusatzpauschale",
    badge: "Empfohlen",
    audience: "Die ausgewogene Standardlösung für mehrere Objekte und planbare Reaktionsfähigkeit.",
    features: [
      "15 Stunden monatliches Betreuungskontingent",
      "Bis zu 3 definierte Objekte",
      "Bis zu 3 planmäßige Vor-Ort-Termine pro Monat",
      "Davon bis zu 2 Stunden flexible Reaktionsreserve",
      "Technische Rundgänge und strukturierte Mängelaufnahme",
      "Störungsaufnahme und erste Fehlereingrenzung",
      "Geeignete Kleinreparaturen und digitale Einsatzrapporte",
      "Digitales Standort- und Leistungskonto",
      "Monatliche Kontingent- und Maßnahmenübersicht",
      "Nachverfolgung offener Maßnahmen",
      "Vorbereitung und Koordination externer Fachunternehmen",
      "Begrenzte Stundenübertragung in einen Folgemonat",
      "Keine zusätzliche Anfahrtspauschale für enthaltene Termine",
    ],
    cta: "Pro unverbindlich anfragen",
  },
  {
    id: "priority",
    name: "Objekt Priority",
    priceEur: 1799,
    hours: 25,
    objects: "Bis zu 3 definierte Objekte",
    visits: "Bis zu 5 Termine / Monat",
    reactionReserve: "Bis zu 5 Stunden",
    shortNoticeVisit: "Bis zu 1 priorisierter Termin / Monat",
    reports: "Digitale Einsatzrapporte",
    monthlyOverview: "Ausführliche Monatsübersicht",
    account: "Digitales Standort- und Leistungskonto",
    followUp: "Priorisierte Nachverfolgung",
    transfer: "Begrenzt in 2 Folgemonate",
    coordination: "Vorbereitung und Koordination",
    travel: "Enthaltene Termine ohne Zusatzpauschale",
    badge: "Maximale Priorisierung",
    audience: "Für hohen laufenden Betreuungsbedarf mit mehr Reserve, Abstimmung und Priorität.",
    features: [
      "25 Stunden monatliches Betreuungskontingent",
      "Bis zu 3 definierte Objekte",
      "Bis zu 5 planmäßige Vor-Ort-Termine pro Monat",
      "Davon bis zu 5 Stunden flexible Reaktionsreserve",
      "Bis zu 1 priorisierter Kurzfristtermin pro Monat",
      "Priorisierte Terminabstimmung innerhalb regulärer Servicezeiten",
      "Technische Rundgänge und strukturierte Mängelaufnahme",
      "Geeignete Kleinreparaturen und digitale Einsatzrapporte",
      "Digitales Standort- und Leistungskonto",
      "Ausführliche monatliche Maßnahmenübersicht",
      "Monatliches technisches Abstimmungsgespräch",
      "Vorbereitung und Koordination externer Fachunternehmen",
      "Begrenzte Stundenübertragung in zwei Folgemonate",
      "Keine zusätzliche Anfahrtspauschale für enthaltene Termine",
    ],
    cta: "Priority unverbindlich anfragen",
  },
] as const;

export const INQUIRY_SELECTION_LABELS: Record<InquirySelection, string> = {
  hausmeisterservice: "Objekt- & Hausmeisterservice",
  stoerungsservice: "Technischer Störungsservice",
  basis: "Objekt Basis",
  business: "Objekt Business",
  pro: "Objekt Pro",
  priority: "Objekt Priority",
};

export const PRICING_FAQ = [
  {
    question: "Was gehört zum Objekt- & Hausmeisterservice?",
    answer:
      "Kontrollgänge, Sicht- und Funktionskontrollen, geeignete Kleinreparaturen, kleinere Montage- und Befestigungsarbeiten, Mängelaufnahme, Dokumentation und organisatorische Unterstützung.",
  },
  {
    question: "Wie werden Einzelaufträge abgerechnet?",
    answer:
      "Je Einsatz gilt eine Stunde Mindestberechnung. Danach erfolgt die Abrechnung transparent in 15-Minuten-Einheiten.",
  },
  {
    question: "Was kostet der Objekt- & Hausmeisterservice?",
    answer:
      "64,99 € pro Arbeitsstunde zuzüglich gegebenenfalls anfallender Material-, Fremdleistungs- und Anfahrtskosten.",
  },
  {
    question: "Was kostet der technische Störungsservice?",
    answer:
      "79,00 € pro Arbeitsstunde zuzüglich gegebenenfalls anfallender Material-, Fremdleistungs- und Anfahrtskosten.",
  },
  {
    question: "Was kosten Zusatzstunden in einem Betreuungspaket?",
    answer:
      "64,99 € pro Stunde. Zusatzstunden werden nur nach vorheriger Abstimmung und Freigabe ausgeführt und in 15-Minuten-Einheiten abgerechnet.",
  },
  {
    question: "Sind Materialien enthalten?",
    answer:
      "Nein, sofern Materialien oder Ersatzteile nicht ausdrücklich als enthalten bezeichnet werden.",
  },
  {
    question: "Kann KusiPrimeTec sämtliche Elektroarbeiten ausführen?",
    answer:
      "Nein. KusiPrimeTec übernimmt technische Erstaufnahme, Fehlereingrenzung, Bestandskontrolle, Dokumentation und geeignete Tätigkeiten im zulässigen Leistungsrahmen. Fachhandwerklich vorbehaltene Arbeiten werden durch geeignete Fachunternehmen ausgeführt oder koordiniert.",
  },
  {
    question: "Gibt es einen 24-Stunden-Notdienst?",
    answer:
      "Nein. Kurzfristige Termine erfolgen nach technischer Priorität, Zugangsmöglichkeit und verfügbarer Kapazität innerhalb der kommunizierten Servicezeiten.",
  },
  {
    question: "Was passiert mit ungenutzten Stunden?",
    answer:
      "Die Übertragung richtet sich nach dem gewählten Paket. Nicht genutzte Stunden werden nicht ausgezahlt und verfallen nach Ablauf der vorgesehenen Übertragungsfrist.",
  },
] as const;

export const PUBLIC_SCOPE_NOTICE =
  "KusiPrimeTec erbringt technische Objektbetreuung, Objekt- und Hausmeisterservice, Bestandsaufnahme, Wartung, Instandhaltung, geeignete Kleinreparaturen und Projektkoordination im rechtlich zulässigen Leistungsrahmen. Fachhandwerklich vorbehaltene Arbeiten, vorgeschriebene Prüfungen, Abnahmen und zulassungspflichtige Tätigkeiten werden durch entsprechend qualifizierte Fachunternehmen ausgeführt oder koordiniert.";

export function isInquirySelection(value: string | null): value is InquirySelection {
  return INQUIRY_SELECTIONS.includes(value as InquirySelection);
}
