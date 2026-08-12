import { LocalServicePage, type LocalServiceContent } from "./local/LocalServicePage";

const content: LocalServiceContent = {
  path: "/objektbetreuung-remstal",
  eyebrow: "Objektbetreuung Remstal",
  title: "Technische Objektbetreuung im Remstal | KusiPrimeTec",
  description: "Planbare Objektkontrollen, Mängelmanagement, Vertretung und Fachfirmenkoordination für Unternehmen, Verwaltungen und Eigentümer im Remstal.",
  h1: "Planbare Objektbetreuung im Remstal",
  lead: "Laufende Objektbetreuung bündelt Kontrollgänge, Mängelaufnahme, geeignete Kleinreparaturen und organisatorische Rückmeldungen in einem nachvollziehbaren Ablauf mit direktem Ansprechpartner.",
  audience: ["Unternehmen mit eigenen Standorten", "Haus- und Immobilienverwaltungen", "Eigentümer von Bestandsobjekten", "Organisationen mit Vertretungsbedarf"],
  cases: [
    { title: "Planmäßige Kontrollgänge", text: "Vereinbarte Objektbereiche werden in einem passenden Rhythmus kontrolliert und als Grundlage für weitere Maßnahmen dokumentiert." },
    { title: "Zentrale Mängelnachverfolgung", text: "Erfasste Auffälligkeiten, Zuständigkeiten und Rückmeldungen werden übersichtlich zusammengeführt und im Alltag nachgehalten." },
    { title: "Vertretungs- und Zusatzunterstützung", text: "Bei Urlaub, Krankheit oder erhöhtem Arbeitsaufkommen kann eine abgestimmte organisatorische Unterstützung vereinbart werden." },
    { title: "Fachfirmenkoordination", text: "Wartungstermine und erforderliche Facharbeiten werden organisatorisch begleitet, ohne die fachliche Verantwortung des ausführenden Unternehmens zu übernehmen." },
  ],
  regionText: "KusiPrimeTec arbeitet aus Schorndorf im Remstal und ungefähr 30 Kilometer Umgebung. Einsätze in Winterbach, Urbach, Remshalden und Plüderhausen werden abhängig von Objekt, Umfang und Termin abgestimmt.",
  boundaryText: "Objektbetreuung ist keine technische Prüfung und ersetzt keine gesetzlich vorgeschriebenen Kontrollen. KusiPrimeTec ist kein Meisterbetrieb; zulassungs- oder meisterpflichtige Arbeiten werden nicht eigenverantwortlich ausgeführt.",
};

export default function ObjektbetreuungRemstalPage() {
  return <LocalServicePage content={content} />;
}
