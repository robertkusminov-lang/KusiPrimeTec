export const BUSINESS_RULES = {
  pricing: {
    hourlyRateEur: 80,
    serviceCallFlatEur: 39,
    roundingRuleText: "Jede angefangene Stunde wird als volle Stunde abgerechnet.",
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
    text: "ab 15 % des Projektvolumens, bei hoherer Komplexitat bis zu 20 % nach Abstimmung",
  },
  scope: {
    allowed: [
      "Technische Objektbetreuung im Bestand",
      "Handwerklich-technischer Allround-Service im zulässigen Rahmen",
      "Kleinreparaturen im zulässigen Rahmen",
      "Störungsaufnahme, Sichtkontrollen und Mängeldokumentation",
      "Wartung und Instandhaltung im laufenden Betrieb",
      "Koordination externer Fachfirmen bei fachpflichtigen Arbeiten",
    ],
    text:
      "KusiPrimeTec arbeitet als technischer Immobilienservice und handwerklich-technischer Allround-Service im zulässigen Rahmen. Der Schwerpunkt liegt auf Bestandsbetreuung, Wartung, Instandhaltung, Störungsaufnahme, Mängeldokumentation, Kleinreparaturen im zulässigen Rahmen und Projektkoordination.",
  },
  exclusions: [
    "Neuinstallationen und Komplettsanierungen",
    "Arbeiten an Zähleranlagen, Hausanschluss oder Netzbetreiber-Schnittstellen",
    "Abnahmen, Prüfungen und eigenverantwortliche Errichtung elektrotechnischer Anlagen",
  ],
  documentation: ["Ticket", "Rapport", "Digitale Ticketabwicklung"],
} as const;

export const COMPANY_PROFILE = {
  name: "KusiPrimeTec",
  ownerName: "Robert Kusminov",
  tagline: "Technischer Immobilienservice im Bestand",
  addressStreet: "Epplerinweg 31",
  addressZipCity: "73614 Schorndorf",
  addressLine: "Epplerinweg 31, 73614 Schorndorf",
  serviceRadiusLine: "Einsatzradius: 30 km ab 73614 Schorndorf",
  serviceAreaHeadline: "Schorndorf und 30 km Umgebung",
  phoneDisplay: "0177 6364393",
  phoneHref: "+491776364393",
  whatsappHref: "https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20habe%20eine%20Anfrage.",
  email: "info@kusiprimetec.de",
  websiteUrl: "https://kusiprimetec.de",
} as const;
