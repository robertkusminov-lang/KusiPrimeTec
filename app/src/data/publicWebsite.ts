export const OBJECT_CARE_PACKAGES = [
  {
    name: "ObjektBetreuung Start",
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
    name: "ObjektBetreuung Plus",
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
    name: "ObjektBetreuung Premium",
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
    name: "ObjektBetreuung Individuell",
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
] as const;

export const OBJECT_CARE_TARGET_GROUPS = [
  "Gewerbebetriebe und Unternehmen",
  "Märkte und Verkaufsflächen",
  "Praxen und Büros",
  "Fitnessstudios",
  "Kleinere Produktions- und Gewerbestandorte",
  "Hausverwaltungen",
  "Gewerbliche Eigentümer von Bestandsimmobilien",
] as const;

export const SECONDARY_TARGET_GROUPS = [
  "Private Eigentümer",
  "Vermieter",
  "Geeignete Privatkunden mit Einzelaufträgen",
] as const;

export const PROBLEM_POINTS = [
  "Kleinere technische Mängel bleiben im Tagesgeschäft liegen.",
  "Zuständigkeiten zwischen Team, Verwaltung und Eigentümern sind oft unklar.",
  "Mehrere Firmen müssen abgestimmt werden, ohne dass jemand den Faden hält.",
  "Ergebnisse werden nicht einheitlich dokumentiert und gehen im Alltag verloren.",
  "Interne Mitarbeitende verlieren Zeit durch Rückfragen, Nachfassen und Ortstermine.",
] as const;

export const OBJECT_CARE_INCLUDED = [
  "Fester technischer Ansprechpartner für wiederkehrende Themen im Bestand",
  "Monatliches Betreuungskontingent",
  "Geplante Sammeltermine statt vieler unkoordinierter Einzelbeauftragungen",
  "Störungs- und Mängelaufnahme mit nachvollziehbarer Priorisierung",
  "Digitale Rapport- und Fotodokumentation",
  "Koordination externer Fachfirmen, wenn Facharbeiten erforderlich sind",
] as const;

export const DIGITAL_WORKFLOW_FEATURES = [
  "Digitale Tickets mit eindeutiger Ticketnummer",
  "Kunden- und Objektzuordnung je Vorgang",
  "Dokumentierte Arbeitszeit und Materialübersicht",
  "Fotodokumentation und Ergebnisbericht",
  "Kundenbestätigung und digitaler Rapport",
  "Kundenportal für bestehende Kunden",
] as const;

export const OBJECT_CARE_RULES = [
  "3 Monate Pilotphase",
  "Anschließend 6 Monate Mindestlaufzeit",
  "Nicht genutzte Stunden können bis zu 2 Monate übertragen werden",
  "Danach verfallen nicht genutzte Stunden",
  "Keine Auszahlung nicht genutzter Stunden",
  "Material, Ersatzteile und Fremdleistungen werden separat berechnet",
] as const;

export const OBJECT_CARE_EXTRA_RULES = [
  "Zusatzarbeiten werden während aktiver Betreuung vorab abgestimmt",
  "Zusatzarbeiten während aktiver Betreuung werden grundsätzlich mit 60 € pro Stunde berechnet",
  "Kurzfristige Unterstützung erfolgt nur nach Verfügbarkeit",
  "Ein garantierter Notdienst ist nicht enthalten",
] as const;

export const OBJECT_CARE_FAQS = [
  {
    question: "Ist die ObjektBetreuung nur ein Stundenpaket?",
    answer:
      "Nein. Das Stundenkontingent ist nur die planbare Grundlage. Der eigentliche Nutzen liegt in fester Betreuung, Priorisierung, Dokumentation und klaren Rückmeldungen.",
  },
  {
    question: "Was passiert, wenn für ein Thema eine Fachfirma nötig ist?",
    answer:
      "KusiPrimeTec kann Bedarf und Zustand aufnehmen, Angebote und Termine koordinieren und die Maßnahme organisatorisch begleiten. Ausführung, Prüfung und Gewährleistung verbleiben beim beauftragten Fachunternehmen.",
  },
  {
    question: "Was passiert mit nicht genutzten Stunden?",
    answer:
      "Nicht genutzte Stunden können bis zu zwei Monate übertragen werden. Danach verfallen sie. Eine Auszahlung ist ausgeschlossen.",
  },
  {
    question: "Gibt es eine garantierte Sofortverfügbarkeit?",
    answer:
      "Nein. Kurzfristige Unterstützung ist innerhalb einer aktiven Betreuung möglich, aber immer abhängig von Verfügbarkeit und Abstimmung.",
  },
] as const;

export const OBJECT_CHECK_FEATURES = [
  "Vorbereitung anhand der übermittelten Objektdaten",
  "Bis zu 90 Minuten Vor-Ort-Begehung",
  "Strukturierte Aufnahme sichtbarer technischer Auffälligkeiten",
  "Fotodokumentation",
  "Priorisierung erkannter Punkte",
  "Kompakte Mängel- und Maßnahmenübersicht",
  "Empfehlung: KusiPrimeTec möglich oder Fachfirma erforderlich",
  "Betreuungsempfehlung und kurzes Abschlussgespräch",
] as const;

export const OBJECT_CHECK_EXCLUSIONS = [
  "Kein Gutachten",
  "Keine gesetzliche Prüfung",
  "Keine Abnahme",
  "Keine VDE-Prüfung",
  "Keine Brandschutzprüfung",
  "Keine Sachverständigenleistung",
] as const;

export const SERVICE_CATEGORIES = [
  {
    title: "Technische ObjektBetreuung",
    text: "Planbare Betreuung für wiederkehrende technische Themen im Bestand mit fester Ansprechperson, klarer Priorisierung und digitaler Dokumentation.",
  },
  {
    title: "ObjektCheck",
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
    title: "Wiederkehrende Beleuchtungsstörungen",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge: "Mehrere Beleuchtungsstörungen in unterschiedlichen Objektbereichen mussten wiederkehrend aufgenommen und eingegrenzt werden.",
    services: [
      "Strukturierte Fehleraufnahme",
      "Eingrenzung defekter Komponenten",
      "Austausch geeigneter Komponenten",
      "Bewertung des Bestandszustands",
      "Dokumentation offener Punkte",
    ],
    outcome: [
      "Teilbereiche wieder funktionsfähig",
      "Weitere Maßnahmen priorisiert",
      "Folgetermine vorbereitet",
    ],
  },
  {
    title: "LED-Modernisierung im laufenden Betrieb",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge: "Mehrere bestehende Leuchten sollten abschnittsweise modernisiert werden, ohne den laufenden Betrieb unnötig zu stören.",
    services: [
      "Bestandsaufnahme",
      "Abschnittsweise Umsetzung",
      "Anpassung an den laufenden Betrieb",
      "Materialermittlung",
      "Folgeterminplanung",
    ],
    outcome: [
      "Vorgesehene Maßnahme umgesetzt",
      "Zusätzliche Mängel dokumentiert",
      "Folgemaßnahmen vorbereitet",
    ],
  },
  {
    title: "Sicherheitsbeleuchtung und Materialreserve",
    context: "Regionaler Lebensmittel-Großhandelsstandort",
    challenge: "Eine defekte Beleuchtungskomponente musste aufgenommen, ersetzt und für künftige Fälle sauber dokumentiert werden.",
    services: [
      "Technische Aufnahme",
      "Austausch der defekten Komponente",
      "Funktionskontrolle",
      "Übergabe geeigneter Reservekomponenten",
      "Rapport und Nachweis",
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
