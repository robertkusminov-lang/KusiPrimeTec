import { BUSINESS_RULES } from "@/config/businessRules";

type ObjectCarePackageId = "start" | "plus" | "premium" | "individual";

export interface ObjectCarePackage {
  id: ObjectCarePackageId;
  name: string;
  priceEur: number | null;
  priceLabel: string;
  hoursLabel: string;
  cadenceLabel: string;
  audience: string;
  points: readonly string[];
  featured?: boolean;
}

export const PUBLIC_OFFER_CONFIG = {
  objectCare: {
    coreMessage: "Planbare technische Entlastung mit festem Ansprechpartner und dokumentiertem Ablauf.",
    packages: [
      {
        id: "start",
        name: "ObjektBetreuung Start",
        priceEur: 399,
        priceLabel: "399 € / Monat",
        hoursLabel: "8 Stunden Betreuungskontingent",
        cadenceLabel: "1 geplanter Sammeltermin pro Monat",
        audience:
          "Geeignet für kleinere Gewerbeflächen, Bestandsobjekte, Praxen, Büros und Eigentümerstrukturen mit planbaren technischen Kleinthemen.",
        points: [
          "Fester technischer Ansprechpartner",
          "Strukturierte Aufnahme offener Punkte",
          "Kleinreparaturen im zulässigen Rahmen",
          "Digitale Dokumentation und Rapport",
          "Nachverfolgung offener Themen",
        ],
      },
      {
        id: "plus",
        name: "ObjektBetreuung Plus",
        priceEur: 599,
        priceLabel: "599 € / Monat",
        hoursLabel: "12 Stunden Betreuungskontingent",
        cadenceLabel: "Bis zu 2 geplante Betreuungstermine pro Monat",
        featured: true,
        audience:
          "Als empfohlenes Hauptpaket für Märkte, Verkaufsflächen, Hausverwaltungen, Büros und Gewerbeobjekte mit wiederkehrendem Abstimmungsbedarf.",
        points: [
          "Planbare technische Entlastung im laufenden Betrieb",
          "Mängel- und Maßnahmenübersicht mit Priorisierung",
          "Bevorzugte Terminplanung gegenüber Einzelanfragen",
          "Koordination externer Fachfirmen nach Bedarf",
          "Saubere Rückmeldungen für Objektakte und Ansprechpartner",
        ],
      },
      {
        id: "premium",
        name: "ObjektBetreuung Premium",
        priceEur: 899,
        priceLabel: "899 € / Monat",
        hoursLabel: "16 Stunden Betreuungskontingent",
        cadenceLabel: "Bis zu 3 geplante Betreuungstermine pro Monat",
        audience:
          "Für Objekte mit erhöhtem laufendem Betreuungsbedarf, mehreren offenen Themen oder höherem Abstimmungsaufwand.",
        points: [
          "Laufende Priorisierung technischer Themen",
          "Mehr Raum für Instandhaltung und Kleinthemen",
          "Erweiterte Dokumentation und Nachverfolgung",
          "Engere Betreuung mehrerer Ansprechpartner",
          "Strukturierte Begleitung wiederkehrender Folgemaßnahmen",
        ],
      },
      {
        id: "individual",
        name: "ObjektBetreuung Individuell",
        priceEur: null,
        priceLabel: "Individuell kalkuliert",
        hoursLabel: "Leistungsumfang nach Objekt, Taktung und Koordinationsbedarf",
        cadenceLabel: "Für mehrere Standorte oder besondere Betriebszeiten",
        audience:
          "Für Kunden mit mehreren Standorten, erweiterten Betriebszeiten oder besonderem Koordinations- und Dokumentationsbedarf.",
        points: [
          "Individuelles Betreuungskonzept",
          "Abgestimmte Kontingente oder Betreuungstage",
          "Mehrere Standorte in einer Struktur möglich",
          "Erweiterte Kommunikations- und Freigabewege",
          "Eigenes Angebot nach Erstabstimmung",
        ],
      },
    ] as readonly ObjectCarePackage[],
    targetGroups: [
      "Gewerbebetriebe und Unternehmen",
      "Märkte und Verkaufsflächen",
      "Praxen und Büros",
      "Fitnessstudios",
      "Kleinere Produktions- und Gewerbestandorte",
      "Hausverwaltungen",
      "Gewerbliche Eigentümer von Bestandsimmobilien",
    ],
    secondaryTargetGroups: [
      "Private Eigentümer",
      "Vermieter",
      "Geeignete Privatkunden mit Einzelaufträgen",
    ],
    included: [
      "Fester technischer Ansprechpartner für wiederkehrende Themen im Bestand",
      "Monatliches Betreuungskontingent",
      "Geplante Sammeltermine statt vieler unkoordinierter Einzelbeauftragungen",
      "Störungs- und Mängelaufnahme mit nachvollziehbarer Priorisierung",
      "Digitale Rapport- und Fotodokumentation",
      "Koordination externer Fachfirmen, wenn Facharbeiten erforderlich sind",
    ],
    rules: [
      "3 Monate Pilotphase",
      "Anschließend 6 Monate Mindestlaufzeit",
      "Nicht genutzte Stunden können bis zu 2 Monate übertragen werden",
      "Danach verfallen nicht genutzte Stunden",
      "Keine Auszahlung nicht genutzter Stunden",
      "Material, Ersatzteile und Fremdleistungen werden separat berechnet",
    ],
    extraRules: [
      "Zusatzarbeiten werden während aktiver Betreuung vorab abgestimmt",
      "Zusatzarbeiten während aktiver Betreuung werden grundsätzlich mit 60 € pro Stunde berechnet",
      "Kurzfristige Unterstützung erfolgt nur nach Verfügbarkeit",
      "Ein garantierter Notdienst ist nicht enthalten",
    ],
    faqs: [
      {
        question: "Für welche Objekte eignet sich die ObjektBetreuung?",
        answer:
          "Die ObjektBetreuung ist vor allem für Gewerbeobjekte und Bestandsimmobilien mit wiederkehrenden technischen Kleinthemen gedacht – zum Beispiel für Märkte, Büros, Praxen, Hausverwaltungen und gewerbliche Eigentümerstrukturen.",
      },
      {
        question: "Welche Arbeiten sind enthalten?",
        answer:
          "Enthalten sind geeignete Service-, Wartungs-, Dokumentations- und Kleinreparaturarbeiten im Bestand sowie Störungs- und Mängelaufnahme, Priorisierung und Rückmeldung im zulässigen Rahmen.",
      },
      {
        question: "Was zählt zum Stundenkontingent?",
        answer:
          "Zum Stundenkontingent zählen die im Rahmen der Betreuung ausgeführten Leistungen im zulässigen Rahmen sowie die dazugehörige Dokumentation und Abstimmung. Material, Ersatzteile und Fremdleistungen werden separat berechnet.",
      },
      {
        question: "Wie funktioniert die Pilotphase?",
        answer:
          "Der Einstieg beginnt mit einer dreimonatigen Pilotphase. Danach läuft die Betreuung entsprechend dem bestehenden Vertragsmodell mit sechs Monaten Mindestlaufzeit weiter.",
      },
      {
        question: "Was passiert mit ungenutzten Stunden?",
        answer:
          "Nicht genutzte Stunden können bis zu zwei Monate übertragen werden. Danach verfallen sie. Eine Auszahlung nicht genutzter Stunden ist nicht vorgesehen.",
      },
      {
        question: "Wie werden Material und Ersatzteile berechnet?",
        answer:
          "Material, Ersatzteile und Fremdleistungen werden separat berechnet. Das Betreuungskontingent betrifft die abgestimmte Leistung von KusiPrimeTec im zulässigen Rahmen.",
      },
      {
        question: "Was geschieht bei fachpflichtigen Arbeiten?",
        answer:
          "Wenn fachpflichtige Arbeiten erforderlich sind, übernimmt KusiPrimeTec auf Wunsch die organisatorische Koordination. Ausführung, Prüfung, Abnahme und Gewährleistung bleiben beim beauftragten Fachunternehmen.",
      },
      {
        question: "Ist ein Notdienst enthalten?",
        answer:
          "Nein. Ein garantierter Notdienst ist nicht Bestandteil der ObjektBetreuung. Kurzfristige Einsätze sind nur nach Verfügbarkeit und vorheriger Abstimmung möglich.",
      },
      {
        question: "Wie werden Einsätze dokumentiert?",
        answer:
          "Leistungen werden über digitale Tickets, Rapporte, Fotodokumentation und nachvollziehbare Rückmeldungen dokumentiert, damit offene Punkte sauber weiterverfolgt werden können.",
      },
    ],
  },
  objectCheck: {
    priceEur: 249,
    priceLabel: "249 €",
    durationLabel: "Bis zu 90 Minuten Vor-Ort-Begehung",
    largerObjectNote:
      "Für größere Objekte, mehrere Standorte oder deutlich erhöhten Aufwand: Preis nach Objektgröße und Aufwand.",
    features: [
      "Vorbereitung anhand der übermittelten Objektdaten",
      "Bis zu 90 Minuten Vor-Ort-Begehung",
      "Strukturierte Aufnahme sichtbarer technischer Auffälligkeiten",
      "Fotodokumentation",
      "Priorisierung erkannter Punkte",
      "Kompakte Mängel- und Maßnahmenübersicht",
      "Empfehlung: KusiPrimeTec möglich oder Fachfirma erforderlich",
      "Betreuungsempfehlung und kurzes Abschlussgespräch",
    ],
    results: [
      "Kompakte digitale Übersicht",
      "Sichtbare Auffälligkeiten mit Fotodokumentation",
      "Priorisierung offener Punkte",
      "Empfohlene nächste Schritte",
      "Zuordnung: KusiPrimeTec möglich oder Fachfirma erforderlich",
      "Betreuungsempfehlung für den weiteren Weg",
    ],
    exclusions: [
      "Kein Gutachten",
      "Keine gesetzliche Prüfung",
      "Keine Abnahme",
      "Keine VDE-Prüfung",
      "Keine Brandschutzprüfung",
      "Keine Sachverständigenleistung",
    ],
  },
  singleOrder: {
    hourlyRateEur: BUSINESS_RULES.pricing.hourlyRateEur,
    serviceCallFlatEur: BUSINESS_RULES.pricing.serviceCallFlatEur,
    roundingRuleText: BUSINESS_RULES.pricing.roundingRuleText,
    surcharges: [...BUSINESS_RULES.surcharges],
    suitableFor: [
      "Geeignete technische Kleinthemen",
      "Störungsaufnahme",
      "Mängelaufnahme",
      "Sichtkontrollen",
      "Kleinreparaturen im zulässigen Rahmen",
      "Wartungs- und Instandhaltungsarbeiten im Bestand",
      "Materialaufnahme",
      "Vorbereitende Aufnahme für Fachfirmen",
    ],
  },
  projectCoordination: {
    basePercent: BUSINESS_RULES.projectCoordination.basePercent,
    maxComplexityPercent: BUSINESS_RULES.projectCoordination.maxComplexityPercent,
    priceLabel: "Ab 15 % des Projektvolumens, bei erhöhter Komplexität bis zu 20 % nach Abstimmung",
    includes: [
      "Bedarf aufnehmen",
      "Informationen bündeln",
      "Angebote einholen",
      "Termine abstimmen",
      "Maßnahmen begleiten",
      "Fortschritt dokumentieren",
      "Rückmeldung an den Auftraggeber",
      "Offene Punkte nachhalten",
    ],
    note:
      "Die fachliche Verantwortung, Ausführung, Prüfung, Abnahme und Gewährleistung verbleiben beim beauftragten Fachunternehmen.",
  },
  scope: {
    summary:
      "KusiPrimeTec übernimmt geeignete Service-, Wartungs-, Dokumentations- und Kleinreparaturarbeiten im Bestand. Weiterführende oder fachpflichtige Arbeiten werden durch entsprechend qualifizierte Fachunternehmen ausgeführt und auf Wunsch durch KusiPrimeTec koordiniert.",
    allowed: [...BUSINESS_RULES.scope.allowed],
    exclusions: [...BUSINESS_RULES.exclusions],
  },
} as const;

export const OBJECT_CARE_PACKAGES = PUBLIC_OFFER_CONFIG.objectCare.packages;
export const OBJECT_CARE_TARGET_GROUPS = PUBLIC_OFFER_CONFIG.objectCare.targetGroups;
export const SECONDARY_TARGET_GROUPS = PUBLIC_OFFER_CONFIG.objectCare.secondaryTargetGroups;
export const OBJECT_CARE_INCLUDED = PUBLIC_OFFER_CONFIG.objectCare.included;
export const OBJECT_CARE_RULES = PUBLIC_OFFER_CONFIG.objectCare.rules;
export const OBJECT_CARE_EXTRA_RULES = PUBLIC_OFFER_CONFIG.objectCare.extraRules;
export const OBJECT_CARE_FAQS = PUBLIC_OFFER_CONFIG.objectCare.faqs;
export const OBJECT_CHECK_FEATURES = PUBLIC_OFFER_CONFIG.objectCheck.features;
export const OBJECT_CHECK_RESULTS = PUBLIC_OFFER_CONFIG.objectCheck.results;
export const OBJECT_CHECK_EXCLUSIONS = PUBLIC_OFFER_CONFIG.objectCheck.exclusions;

export const PROBLEM_POINTS = [
  "Kleinere technische Mängel bleiben im Tagesgeschäft liegen.",
  "Zuständigkeiten zwischen Team, Verwaltung und Eigentümern sind oft unklar.",
  "Mehrere Firmen müssen abgestimmt werden, ohne dass jemand den Faden hält.",
  "Ergebnisse werden nicht einheitlich dokumentiert und gehen im Alltag verloren.",
  "Interne Mitarbeitende verlieren Zeit durch Rückfragen, Nachfassen und Ortstermine.",
] as const;

export const DIGITAL_WORKFLOW_FEATURES = [
  "Digitale Tickets mit eindeutiger Ticketnummer",
  "Kunden- und Objektzuordnung je Vorgang",
  "Dokumentierte Arbeitszeit und Materialübersicht",
  "Fotodokumentation und Ergebnisbericht",
  "Kundenbestätigung und digitaler Rapport",
  "Kundenportal für bestehende Kunden",
] as const;

export const SERVICE_CATEGORIES = [
  {
    title: "Technische ObjektBetreuung",
    text: "Planbare Betreuung für wiederkehrende technische Themen im Bestand mit fester Ansprechperson, klarer Priorisierung und digitaler Dokumentation.",
  },
  {
    title: "ObjektCheck Gewerbe",
    text: "Kostenpflichtiger Einstiegscheck für sichtbare technische Auffälligkeiten, Mängelstruktur und nächste Schritte im Objekt.",
  },
  {
    title: "Störungs- und Mängelaufnahme",
    text: "Sichtbare Auffälligkeiten, Kleinthemen und operative Meldungen werden sauber aufgenommen, eingeordnet und dokumentiert.",
  },
  {
    title: "Wartung und Instandhaltung im Bestand",
    text: "Laufende Bestandsunterstützung für wiederkehrende kleinere Themen und vorbereitende Instandhaltungsarbeiten im zulässigen Rahmen.",
  },
  {
    title: "Kleinreparaturen im zulässigen Rahmen",
    text: "Praktische Unterstützung bei kleineren technischen und handwerklichen Themen, soweit sie nicht fachpflichtigen Gewerken vorbehalten sind.",
  },
  {
    title: "Beleuchtung und LED-Maßnahmen im zulässigen Rahmen",
    text: "Bestandsnahe Maßnahmen, Austausch geeigneter Komponenten und abschnittsweise Verbesserungen im laufenden Betrieb.",
  },
  {
    title: "Technische Dokumentation",
    text: "Rapporte, Fotodokumentation, Mängelübersichten und nachvollziehbare Rückmeldungen für Kunde, Eigentum oder Verwaltung.",
  },
  {
    title: "Fachfirmen- und Projektkoordination",
    text: "Organisatorische Begleitung externer Fachunternehmen von der Bedarfserfassung bis zur abgestimmten Rückmeldung.",
  },
] as const;

export const REFERENCE_CASES = [
  {
    title: "Wiederkehrende Beleuchtungsstörungen strukturiert bearbeitet",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge:
      "Mehrere Beleuchtungsstörungen in unterschiedlichen Objektbereichen mussten wiederkehrend aufgenommen und eingegrenzt werden.",
    services: [
      "Strukturierte Aufnahme",
      "Eingrenzung defekter Komponenten",
      "Geeignete Reparaturen",
      "Bewertung des Bestandszustands",
      "Planung weiterer LED-Maßnahmen",
      "Dokumentation offener Punkte",
    ],
    outcome: [
      "Betroffene Bereiche teilweise unmittelbar wiederhergestellt",
      "Weitere Maßnahmen priorisiert",
      "Folgetermine vorbereitet",
    ],
  },
  {
    title: "LED-Modernisierung im laufenden Betrieb",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge:
      "Mehrere Bestandsleuchten sollten abschnittsweise modernisiert werden, ohne den laufenden Betrieb unnötig zu stören.",
    services: [
      "Bestandsaufnahme",
      "Abschnittsweise Bearbeitung",
      "Anpassung an Betriebsabläufe",
      "Zusätzliche Mängelaufnahme",
      "Materialermittlung",
      "Folgeterminplanung",
    ],
    outcome: [
      "Vorgesehene Maßnahmen umgesetzt",
      "Weitere Auffälligkeiten dokumentiert",
      "Nächste Schritte organisiert",
    ],
  },
  {
    title: "Sicherheitsbeleuchtung instand gesetzt",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge:
      "Eine defekte Beleuchtungskomponente musste aufgenommen, ersetzt und für künftige Fälle sauber dokumentiert werden.",
    services: [
      "Technische Aufnahme",
      "Austausch der defekten Komponente",
      "Funktionskontrolle",
      "Übergabe von Reservekomponenten",
      "Digitaler Rapport",
    ],
    outcome: [
      "Funktion wiederhergestellt",
      "Reserve für künftigen Bedarf vorhanden",
      "Maßnahme nachvollziehbar dokumentiert",
    ],
  },
] as const;

export const BUSINESS_MODEL_PROMISES = [
  "Fester technischer Ansprechpartner",
  "Planbare Betreuung",
  "Weniger liegen gebliebene Kleinthemen",
  "Strukturierte Störungs- und Mängelaufnahme",
  "Nachvollziehbare Priorisierung",
  "Digitale Dokumentation",
  "Klare Rückmeldungen",
  "Koordination weiterführender Fachfirmen",
  "Persönliche regionale Betreuung",
] as const;
