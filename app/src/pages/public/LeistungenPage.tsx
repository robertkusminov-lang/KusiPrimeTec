import { LazySection } from "@/components/ui/LazySection";
import {
  KOORDINATION_RECHTSTEXT,
  LEISTUNGEN,
  LEISTUNGSUMFANG_ERLAUBT,
  LEISTUNGSUMFANG_HINWEIS,
  LEISTUNGSUMFANG_NICHT,
} from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { NavLink } from "react-router-dom";

const PREMIUM_STANDARDS = [
  "Klare Verantwortlichkeiten und feste Ansprechpartner",
  "Nachvollziehbare Dokumentation je Einsatz",
  "Transparente Preis- und Leistungsdarstellung",
  "Strukturierte Koordination externer Fachfirmen",
];

export default function LeistungenPage() {
  useSeo({
    title: "Technischer Immobilienservice & Leistungen | KusiPrimeTec",
    description:
      "Technische Objektbetreuung, Kleinreparaturen im zulässigen Rahmen, Instandhaltung, Störungsaufnahme und Projektkoordination für Bestandsimmobilien und Gewerbeobjekte im Raum Schorndorf.",
  });

  return (
    <div className="page-enter page-stack">
      <header className="premium-card page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsspektrum</p>
        <h1 className="public-page-title mt-2 text-white">Technischer Immobilienservice für Bestandsobjekte</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Für Unternehmen, Verwaltungen, Eigentümer, Märkte, Praxen und Büros: strukturierte Technikleistungen,
          handwerklich-technischer Allround-Service im zulässigen Rahmen und saubere Objektprozesse.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-electric-100/90 md:text-base">
          Direkt durch uns: Kleinreparaturen im zulässigen Rahmen, Störungsaufnahme, Sichtkontrollen,
          Mängeldokumentation und laufende Instandhaltung im Bestand.
        </p>
      </header>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={280} delayMs={50}>
        {LEISTUNGEN.map((item) => (
          <article key={item.titel} className="premium-card p-5">
            <h2 className="text-xl font-semibold text-white">{item.titel}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{item.text}</p>
          </article>
        ))}
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={180} delayMs={60}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektCheck & laufende Betreuung</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Technische Bestandsaufnahme als Einstieg in klare Objektbetreuung</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-soft)]">
          Mit dem KusiPrimeTec ObjektCheck erhalten Eigentümer, Hausverwaltungen und Gewerbekunden eine strukturierte
          Sicht auf sichtbare Mängel, Instandhaltungspunkte und sinnvolle nächste Schritte im Bestand.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <NavLink to="/objektbetreuung" className="btn-primary-premium rounded-full px-5 py-3 text-sm font-semibold">
            Objektbetreuung ansehen
          </NavLink>
          <NavLink to="/objektbetreuung-anfrage" className="btn-secondary-premium rounded-full px-5 py-3 text-sm font-semibold">
            Objekt unverbindlich besprechen
          </NavLink>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={210} delayMs={70}>
        <h2 className="text-xl font-semibold text-white">Hinweis zu Leistungsumfang</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{LEISTUNGSUMFANG_HINWEIS}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-300/30 bg-emerald-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Leistungsrahmen</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_ERLAUBT.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-rose-300/30 bg-rose-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">Nicht direkt durch uns ausführbar</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_NICHT.map((item) => (
                <li key={item}>✗ {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={170} delayMs={90}>
        <h2 className="text-xl font-semibold text-white">Projektkoordination externer Gewerke</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{KOORDINATION_RECHTSTEXT}</p>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card" minHeight={180} delayMs={110}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Qualitätsstandard</p>
        <h2 className="mt-2 text-xl font-semibold text-white">So sichern wir Qualität im Tagesgeschäft</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {PREMIUM_STANDARDS.map((point) => (
            <li key={point} className="premium-card p-3 text-sm text-[var(--text-main)]">
              ✓ {point}
            </li>
          ))}
        </ul>
      </LazySection>
    </div>
  );
}
