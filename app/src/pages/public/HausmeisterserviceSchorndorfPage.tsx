import { LocalServicePage, type LocalServiceContent } from "./local/LocalServicePage";

const content: LocalServiceContent = {
  path: "/hausmeisterservice-schorndorf",
  eyebrow: "Hausmeisterservice Schorndorf",
  title: "Hausmeisterservice in Schorndorf für Bestandsobjekte | KusiPrimeTec",
  description: "Objektkontrollen, Mängeldokumentation und zulässige Kleinreparaturen für Gewerbe-, Wohn- und Mischobjekte in Schorndorf und Umgebung.",
  h1: "Objekt- und Hausmeisterservice in Schorndorf",
  lead: "KusiPrimeTec unterstützt Unternehmen, Verwaltungen und Eigentümer bei wiederkehrenden Kontrollen, sichtbaren Mängeln, geeigneten Kleinreparaturen und organisatorischen Aufgaben rund um Bestandsobjekte.",
  audience: ["Büros und Praxen", "Einzelhandel und Gastronomie", "Gewerbe- und Mischobjekte", "Eigentümer und Hausverwaltungen"],
  cases: [
    { title: "Regelmäßige Objektkontrollen", text: "Zugängliche Bereiche, sichtbare Auffälligkeiten und vereinbarte Funktionspunkte werden kontrolliert und nachvollziehbar dokumentiert." },
    { title: "Mängelaufnahme", text: "Offene Punkte werden mit Ort, Beschreibung und sinnvoller Priorisierung erfasst, damit Zuständigkeiten nicht verloren gehen." },
    { title: "Zulässige Kleinreparaturen", text: "Geeignete kleinere Arbeiten im nicht zulassungs- oder meisterpflichtigen Rahmen können direkt eingeordnet und umgesetzt werden." },
    { title: "Koordination weiterer Schritte", text: "Wenn ein Fachunternehmen erforderlich ist, unterstützt KusiPrimeTec organisatorisch bei Termin, Informationsübergabe und Rückmeldung." },
  ],
  regionText: "Der Schwerpunkt liegt in Schorndorf und im ungefähr 30 Kilometer großen Einsatzgebiet. Dazu gehören im nachvollziehbaren regionalen Zusammenhang auch Winterbach, Urbach, Remshalden und Plüderhausen.",
  boundaryText: "Der Hausmeisterservice umfasst keine zulassungspflichtigen Facharbeiten, technischen Sicherheitsprüfungen, Abnahmen oder Sachverständigenleistungen. Erforderliche Facharbeiten bleiben entsprechend qualifizierten Unternehmen vorbehalten.",
};

export default function HausmeisterserviceSchorndorfPage() {
  return <LocalServicePage content={content} />;
}
