import { BUSINESS_RULES } from "@/config/businessRules";

import { PUBLIC_SCOPE_NOTICE } from "@/config/publicServices";

export const NAV_PUBLIC = [
  { href: "/", label: "Startseite" },
  { href: "/leistungen", label: "Leistungen" },
  { href: "/objektbetreuung", label: "Objektbetreuung" },
  { href: "/preise", label: "Preise" },
  { href: "/ablauf", label: "Ablauf" },
  { href: "/buchen", label: "Anfragen" },
  { href: "/konto/anmelden", label: "Kundenlogin" },
];

export const FOOTER_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
  { href: "/haftung-koordination", label: "Haftung Koordination" },
];

export const LEISTUNGEN = [
  {
    titel: "Objekt- & Hausmeisterservice",
    text: "Kontrollgänge, Sicht- und Funktionskontrollen, geeignete Kleinreparaturen, Mängelaufnahme und organisatorische Unterstützung mit digitaler Dokumentation.",
  },
  {
    titel: "Technische Objektbetreuung",
    text: "Regelmäßige Unterstützung für Bestandsimmobilien, Gewerbeobjekte, Praxen, Büros, Märkte und Verwaltungen mit klarer Dokumentation, festen Ansprechpartnern und planbaren Abläufen.",
  },
  {
    titel: "Handwerklich-technischer Allround-Service im zulässigen Rahmen",
    text: "Praktische Unterstützung bei kleineren technischen und handwerklichen Themen im Bestand, sofern diese nicht meisterpflichtig oder fachpflichtig sind.",
  },
  {
    titel: "Störungsaufnahme, Mängeldokumentation und Sichtkontrollen",
    text: "Sichtbare Mängel, technische Auffälligkeiten und offene Punkte werden strukturiert aufgenommen, priorisiert und nachvollziehbar dokumentiert.",
  },
  {
    titel: "Projektkoordination externer Fachfirmen",
    text: "Wenn Facharbeiten erforderlich sind, koordiniert KusiPrimeTec externe Fachfirmen, bündelt Informationen und hält Maßnahmen transparent nach.",
  },
];

export const LEISTUNGSUMFANG_HINWEIS = PUBLIC_SCOPE_NOTICE;

export const KOORDINATION_RECHTSTEXT =
  "Projektkoordination ist bei KusiPrimeTec eine organisatorische Leistung. Dazu gehören Angebotseinholung, Terminabstimmung, Maßnahmenbegleitung, Rückmeldung an Eigentümer oder Verwaltung sowie strukturierte Dokumentation. Die fachliche Ausführung fachpflichtiger Arbeiten erfolgt ausschließlich durch qualifizierte Fachfirmen; Verantwortung, Ausführung, Abnahme und Gewährleistung verbleiben beim jeweils beauftragten Unternehmen.";

export const LEISTUNGSUMFANG_ERLAUBT = [...BUSINESS_RULES.scope.allowed];
export const LEISTUNGSUMFANG_NICHT = [...BUSINESS_RULES.exclusions];

export const PREISE = {
  stundensatz: BUSINESS_RULES.pricing.hourlyRateEur,
  einsatzpauschale: BUSINESS_RULES.pricing.serviceCallFlatEur,
  abrechnungshinweis: BUSINESS_RULES.pricing.roundingRuleText,
  zuschlaege: [...BUSINESS_RULES.surcharges],
  projektkoordination: BUSINESS_RULES.projectCoordination.text,
};

export const ABLAUF = [
  "Anfrage oder Ticket für Objekt, Standort und Thema erfassen",
  "Technische Einordnung, Sichtung und Priorisierung im Bestand",
  "Terminabstimmung mit Ansprechpartner vor Ort",
  "Umsetzung im zulässigen Rahmen oder strukturierte Koordination externer Fachfirmen",
  "Rapport, Nachweis und klare Rückmeldung für die Objektakte",
];

export const PUBLIC_PATHS = [
  {
    href: "/einzelauftrag",
    title: "Einzelauftrag anfragen",
    text: "Für einmalige Einsätze, Kleinreparaturen, Störungsaufnahme, Terminwünsche oder Rückfragen im Bestand.",
  },
  {
    href: "/objektbetreuung-anfrage",
    title: "ObjektBetreuung anfragen",
    text: "Für laufende technische Objektbetreuung, ObjektCheck, Beratung und strukturierte Betreuungspakete.",
  },
  {
    href: "/konto/anmelden",
    title: "Kundenlogin",
    text: "Nur für bestehende Kunden mit zugewiesenem Kundenkonto und freigeschalteten Objekten.",
  },
] as const;

export const KATEGORIEN = [
  "Einzelauftrag",
  "Kleinreparatur",
  "Mängelaufnahme",
  "Instandhaltung",
  "Sichtkontrolle",
  "Wartung im Bestand",
  "Handwerklich-technischer Allround-Service",
  "ObjektCheck",
  "ObjektBetreuung",
  "Fachfirma erforderlich",
  "Material benötigt",
  "Rückfrage Kunde",
  "Terminplanung",
  "Dokumentation",
  "Sonstiges",
] as const;

export const CUSTOMER_URGENCY_OPTIONS = [
  { value: "mittel", label: "Normal" },
  { value: "hoch", label: "Zeitnah" },
  { value: "kritisch", label: "Dringend" },
  { value: "kritisch", label: "Sicherheitsrelevant / bitte prüfen" },
] as const;

export const DRINGLICHKEITEN = ["niedrig", "mittel", "hoch", "kritisch"] as const;

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/interessenten", label: "Interessenten" },
  { href: "/admin/objekte", label: "Objekte" },
  { href: "/admin/kunden", label: "Kundenstamm" },
  { href: "/admin/archiv", label: "Archiv" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/einstellungen", label: "Einstellungen" },
];
