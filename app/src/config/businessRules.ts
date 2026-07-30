import { PUBLIC_PRICING, TECHNICAL_SERVICE_HOURLY_EUR } from "@/config/publicServices";

export const BUSINESS_RULES = {
  pricing: {
    hourlyRateEur: TECHNICAL_SERVICE_HOURLY_EUR,
    serviceCallFlatEur: PUBLIC_PRICING.serviceCallFlatEur,
    roundingRuleText: PUBLIC_PRICING.billingNotice,
  },
  surcharges: [
    { label: "Mo-Fr nach 17:00 Uhr (Überstunden)", value: "+20 %" },
    { label: "Samstag", value: "+35 %" },
    { label: "Sonntag/Feiertag", value: "+100 %" },
  ],
  response: {
    text: "Rückmeldung innerhalb 24 Stunden (Mo-Fr 09:00-17:00 Uhr)",
    hours: 24,
    weekdaysOnly: true,
  },
  openingHours: {
    start: "09:00",
    end: "17:00",
    slotMinutes: 30,
    weekdaysOnly: true,
  },
  serviceArea: {
    radiusKm: 30,
    centerZip: "73614",
    centerCity: "Schorndorf",
    text: "30 km ab 73614 Schorndorf",
  },
  projectCoordination: {
    basePercent: 15,
    maxComplexityPercent: 20,
    text: "ab 15 % vom Projektvolumen, bei hoher Komplexität nach Abstimmung",
  },
  scope: {
    allowed: [
      "Technische Objektbetreuung im Bestand",
      "Objekt- & Hausmeisterservice im zulässigen Rahmen",
      "Handwerklich-technischer Allround-Service im zulässigen Rahmen",
      "Kleinreparaturen im zulässigen Rahmen",
      "Störungsaufnahme, Sichtkontrollen und Mängeldokumentation",
      "Wartung und Instandhaltung im laufenden Betrieb",
      "Koordination externer Fachfirmen bei fachpflichtigen Arbeiten",
    ],
    text:
      "KusiPrimeTec arbeitet als technischer Immobilienservice mit ergänzendem Objekt- und Hausmeisterservice im zulässigen Rahmen. Der Schwerpunkt liegt auf Bestandsbetreuung, Wartung, Instandhaltung, Störungsaufnahme, Mängeldokumentation, geeigneten Kleinreparaturen und Projektkoordination.",
  },
  exclusions: [
    "Neuinstallationen und Komplettsanierungen",
    "Arbeiten an Zähleranlagen, Hausanschluss oder Netzbetreiber-Schnittstellen",
    "Abnahmen, Prüfungen und eigenverantwortliche Errichtung elektrotechnischer Anlagen",
  ],
  documentation: ["Ticket", "Rapport", "Digitale Ticketabwicklung"],
} as const;

export const COMPANY_PROFILE = {
  tagline: "Technischer Immobilienservice im Bestand",
  addressStreet: "Epplerinweg 31",
  addressZipCity: "73614 Schorndorf",
  addressLine: "Epplerinweg 31, 73614 Schorndorf",
  serviceRadiusLine: "Einsatzradius: 30 km ab 73614 Schorndorf",
} as const;
