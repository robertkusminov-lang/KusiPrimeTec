export type ObjectCheckArea = "control" | "defects" | "response" | "coordination";

export type ObjectCheckAnswers = Record<string, string>;

export interface ObjectCheckOption {
  value: string;
  label: string;
  score: number;
}

export interface ObjectCheckQuestion {
  id: string;
  area: ObjectCheckArea;
  title: string;
  hint: string;
  options: ObjectCheckOption[];
}

export interface ObjectCheckResult {
  total: number;
  category: "Strukturiert betreut" | "Punktueller Optimierungsbedarf" | "Erhöhter Betreuungsbedarf" | "Strukturaufbau empfohlen";
  areas: Record<ObjectCheckArea, number>;
  recommendations: string[];
  nextStep: string;
}

export const OBJECT_CHECK_QUESTIONS: ObjectCheckQuestion[] = [
  {
    id: "property_type",
    area: "coordination",
    title: "Welche Art von Objekt wird betreut?",
    hint: "Wählen Sie die Nutzung, die am ehesten passt.",
    options: [
      { value: "office", label: "Büro oder Praxis", score: 0 },
      { value: "retail", label: "Einzelhandel oder Gastronomie", score: 1 },
      { value: "production", label: "Produktion oder Gewerbe", score: 2 },
      { value: "mixed", label: "Wohn- oder Mischobjekt", score: 1 },
      { value: "social", label: "Soziale, kirchliche oder Vereinsnutzung", score: 1 },
    ],
  },
  {
    id: "property_scope",
    area: "control",
    title: "Wie groß ist der betreute Bestand?",
    hint: "Eine grobe Einordnung genügt.",
    options: [
      { value: "one_small", label: "Ein kleineres Objekt", score: 0 },
      { value: "one_large", label: "Ein größeres Objekt", score: 1 },
      { value: "several", label: "Mehrere überschaubare Objekte", score: 1 },
      { value: "portfolio", label: "Mehrere größere oder verteilte Objekte", score: 2 },
      { value: "unknown", label: "Noch nicht eindeutig erfasst", score: 2 },
    ],
  },
  {
    id: "control_frequency",
    area: "control",
    title: "Wie häufig finden dokumentierte Objektkontrollen statt?",
    hint: "Gemeint sind planmäßige Kontrollgänge mit nachvollziehbarer Rückmeldung.",
    options: [
      { value: "weekly", label: "Wöchentlich oder häufiger", score: 0 },
      { value: "monthly", label: "Mindestens monatlich", score: 0 },
      { value: "occasional", label: "Gelegentlich, aber nicht fest geplant", score: 1 },
      { value: "reactive", label: "Vorwiegend bei einem konkreten Anlass", score: 2 },
      { value: "none", label: "Derzeit nicht organisiert", score: 2 },
    ],
  },
  {
    id: "defect_tracking",
    area: "defects",
    title: "Wie werden Mängel erfasst und nachverfolgt?",
    hint: "Berücksichtigen Sie Erfassung, Zuständigkeit und Abschlusskontrolle.",
    options: [
      { value: "central", label: "Zentral dokumentiert, klar zugewiesen und nachverfolgt", score: 0 },
      { value: "mostly", label: "Überwiegend nachvollziehbar, einzelne Lücken möglich", score: 1 },
      { value: "distributed", label: "Auf verschiedene Listen, E-Mails oder Personen verteilt", score: 2 },
      { value: "unknown", label: "Der aktuelle Stand ist nicht eindeutig", score: 2 },
    ],
  },
  {
    id: "incident_frequency",
    area: "response",
    title: "Wie häufig treten technische Störungen oder Kleinreparaturen auf?",
    hint: "Eine ungefähre Einschätzung aus dem laufenden Betrieb reicht aus.",
    options: [
      { value: "rare", label: "Selten", score: 0 },
      { value: "occasional", label: "Gelegentlich", score: 1 },
      { value: "frequent", label: "Regelmäßig", score: 2 },
      { value: "unknown", label: "Nicht verlässlich erfasst", score: 2 },
    ],
  },
  {
    id: "open_defects",
    area: "defects",
    title: "Wie viele offene Mängel sind ungefähr bekannt?",
    hint: "Wählen Sie die aktuell passendste Größenordnung.",
    options: [
      { value: "none", label: "Keine", score: 0 },
      { value: "one_to_three", label: "1 bis 3", score: 1 },
      { value: "four_to_ten", label: "4 bis 10", score: 2 },
      { value: "more_than_ten", label: "Mehr als 10", score: 2 },
      { value: "unknown", label: "Unbekannt", score: 2 },
    ],
  },
  {
    id: "contractor_coordination",
    area: "coordination",
    title: "Wie sind Fachfirmen, Wartungstermine und Rückmeldungen organisiert?",
    hint: "Bewerten Sie den organisatorischen Ablauf, nicht die fachliche Ausführung.",
    options: [
      { value: "central", label: "Zentral koordiniert und nachvollziehbar dokumentiert", score: 0 },
      { value: "partial", label: "Teilweise geregelt, abhängig vom jeweiligen Vorgang", score: 1 },
      { value: "ad_hoc", label: "Überwiegend bei Bedarf und ohne festen Ablauf", score: 2 },
      { value: "unknown", label: "Zuständigkeit oder Rückmeldungen sind häufig unklar", score: 2 },
    ],
  },
  {
    id: "coverage",
    area: "response",
    title: "Wie ist die Vertretung bei Urlaub oder Krankheit geregelt?",
    hint: "Gemeint ist die organisatorische Erreichbarkeit für laufende Objektthemen.",
    options: [
      { value: "fixed", label: "Verbindlich geregelt und dokumentiert", score: 0 },
      { value: "informal", label: "Informell abgestimmt", score: 1 },
      { value: "none", label: "Derzeit nicht geregelt", score: 2 },
      { value: "unknown", label: "Nicht eindeutig bekannt", score: 2 },
    ],
  },
];

export const OBJECT_CHECK_AREA_LABELS: Record<ObjectCheckArea, string> = {
  control: "Kontrollrhythmus",
  defects: "Mängeldokumentation",
  response: "Störungsreaktion & Vertretung",
  coordination: "Fachfirmenkoordination",
};

const RECOMMENDATIONS: Record<ObjectCheckArea, [string, string, string]> = {
  control: [
    "Den bestehenden Kontrollrhythmus beibehalten und regelmäßig kurz dokumentieren.",
    "Feste Kontrollintervalle mit einer einheitlichen Rückmeldung für das Objekt definieren.",
    "Einen verbindlichen Kontrollplan mit Zuständigkeit und dokumentiertem Abschluss aufbauen.",
  ],
  defects: [
    "Die zentrale Mängelliste weiterführen und erledigte Punkte nachvollziehbar abschließen.",
    "Offene Mängel in einer gemeinsamen Liste mit Zuständigkeit und Termin zusammenführen.",
    "Mängelbestand zuerst erfassen, priorisieren und mit klaren Verantwortlichkeiten nachverfolgen.",
  ],
  response: [
    "Die vorhandenen Reaktions- und Vertretungswege regelmäßig auf Aktualität prüfen.",
    "Ansprechpartner und Vertretung für wiederkehrende Störungen schriftlich festlegen.",
    "Einen geregelten Ablauf für Störungsmeldung, Rückmeldung und Ausfallvertretung einrichten.",
  ],
  coordination: [
    "Die vorhandene Fachfirmenkoordination mit Termin- und Rückmeldestatus fortführen.",
    "Wartungstermine, Beauftragungen und Rückmeldungen an einer Stelle zusammenführen.",
    "Eine zentrale Koordination für Fachfirmen, Termine, Unterlagen und Rückmeldungen aufbauen.",
  ],
};

function resultCategory(total: number): ObjectCheckResult["category"] {
  if (total <= 3) return "Strukturiert betreut";
  if (total <= 7) return "Punktueller Optimierungsbedarf";
  if (total <= 11) return "Erhöhter Betreuungsbedarf";
  return "Strukturaufbau empfohlen";
}

function recommendationFor(area: ObjectCheckArea, score: number): string {
  const level = score <= 1 ? 0 : score <= 2 ? 1 : 2;
  return RECOMMENDATIONS[area][level];
}

export function evaluateObjectCheck(answers: ObjectCheckAnswers): ObjectCheckResult {
  const areas: Record<ObjectCheckArea, number> = { control: 0, defects: 0, response: 0, coordination: 0 };

  for (const question of OBJECT_CHECK_QUESTIONS) {
    const selected = question.options.find((option) => option.value === answers[question.id]);
    if (!selected) throw new Error(`Unvollständige Antwort für ${question.id}`);
    areas[question.area] += selected.score;
  }

  const total = Object.values(areas).reduce((sum, score) => sum + score, 0);
  const rankedAreas = (Object.keys(areas) as ObjectCheckArea[]).sort((a, b) => areas[b] - areas[a]);
  const recommendations = rankedAreas.slice(0, 3).map((area) => recommendationFor(area, areas[area]));

  return {
    total,
    category: resultCategory(total),
    areas,
    recommendations,
    nextStep:
      total <= 3
        ? "Nutzen Sie das Ergebnis als kurze Bestätigung Ihrer Organisation und prüfen Sie die Abläufe in regelmäßigen Abständen erneut."
        : "Wählen Sie einen überschaubaren Bereich aus und schaffen Sie dort zuerst einen klaren, dokumentierten Ablauf.",
  };
}

export function buildAnswersForScore(optionScore: 0 | 1 | 2): ObjectCheckAnswers {
  return Object.fromEntries(
    OBJECT_CHECK_QUESTIONS.map((question) => {
      const option = question.options.find((entry) => entry.score === optionScore) || question.options[0];
      return [question.id, option.value];
    }),
  );
}
