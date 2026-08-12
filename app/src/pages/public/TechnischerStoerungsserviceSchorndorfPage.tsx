import { LocalServicePage, type LocalServiceContent } from "./local/LocalServicePage";

const content: LocalServiceContent = {
  path: "/technischer-stoerungsservice-schorndorf",
  eyebrow: "Störungsservice Schorndorf",
  title: "Technischer Störungsservice in Schorndorf | KusiPrimeTec",
  description: "Strukturierte Störungsaufnahme, Dokumentation, zulässige Kleinreparaturen und Fachfirmenkoordination für Bestandsobjekte im Raum Schorndorf.",
  h1: "Technischer Störungsservice für Bestandsobjekte in Schorndorf",
  lead: "Bei technischen Auffälligkeiten im Gebäudebestand unterstützt KusiPrimeTec mit strukturierter Aufnahme, nachvollziehbarer Dokumentation, geeigneten Maßnahmen im zulässigen Rahmen und klarer Koordination weiterer Schritte.",
  audience: ["Gewerbebetriebe und Märkte", "Büros, Praxen und Gastronomie", "Verwaltungen und Eigentümer", "Standorte ohne eigene technische Betreuung"],
  cases: [
    { title: "Störung strukturiert aufnehmen", text: "Symptom, betroffener Bereich, Zeitpunkt und erkennbare Auswirkungen werden erfasst, damit der nächste Schritt nachvollziehbar geplant werden kann." },
    { title: "Sichtbare Ursache dokumentieren", text: "Zugängliche Auffälligkeiten können fotografisch und schriftlich festgehalten werden. Dies ist keine Sicherheits- oder Fachprüfung." },
    { title: "Geeignete Kleinmaßnahme", text: "Wenn eine zulässige, überschaubare Kleinreparatur möglich ist, kann sie nach Abstimmung im vereinbarten Leistungsrahmen erfolgen." },
    { title: "Fachunternehmen einbinden", text: "Bei fachpflichtigen Themen werden Informationen gebündelt und geeignete Fachfirmen organisatorisch koordiniert." },
  ],
  regionText: "Der technische Störungsservice wird im Raum Schorndorf und ungefähr 30 Kilometer Umgebung angeboten. Winterbach, Urbach, Remshalden und Plüderhausen liegen innerhalb des regionalen Einsatzumfelds.",
  boundaryText: "KusiPrimeTec bietet keine 24/7-Bereitschaft und keine elektrotechnischen Abnahmen oder Sicherheitsprüfungen. Regulär veröffentlichte Erreichbarkeit ist Montag bis Freitag von 09:00 bis 17:00 Uhr.",
};

export default function TechnischerStoerungsserviceSchorndorfPage() {
  return <LocalServicePage content={content} />;
}
