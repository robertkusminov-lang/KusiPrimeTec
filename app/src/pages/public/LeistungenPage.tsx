import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { PricingFaq, PublicPriceNotes, ServicePricingCards } from "@/components/public/PricingSections";
import { PUBLIC_SCOPE_NOTICE } from "@/config/publicServices";
import {
  KOORDINATION_RECHTSTEXT,
  LEISTUNGEN,
  LEISTUNGSUMFANG_ERLAUBT,
  LEISTUNGSUMFANG_NICHT,
} from "@/data/content";
import { useSeo } from "@/hooks/useSeo";

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
      "Technischer Störungsservice, Objekt- und Hausmeisterservice, monatliche Objektbetreuung und Projektkoordination für Bestandsimmobilien im Raum Schorndorf.",
    canonicalPath: "/leistungen",
  });

  return (
    <div className="page-enter page-stack-large">
      <header className="premium-card premium-card-strong page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsspektrum</p>
        <h1 className="public-page-title mt-2 text-white">Technischer Immobilienservice für Bestandsobjekte</h1>
        <p className="public-page-lead mt-3 max-w-4xl">
          Technischer Störungsservice, Objekt- und Hausmeisterservice, monatliche Objektbetreuung und
          Projektkoordination für Unternehmen, Verwaltungen und Eigentümer im Raum Schorndorf.
        </p>
      </header>

      <LazySection className="space-y-5" minHeight={460} delayMs={35}>
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Einzelleistungen</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Passender Service für Objekt oder Störung</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
            Beide Leistungen werden klar dokumentiert. Je Einsatz gilt eine Stunde Mindestberechnung, danach erfolgt
            die Abrechnung in 15-Minuten-Einheiten.
          </p>
        </header>
        <ServicePricingCards />
        <PublicPriceNotes />
        <NavLink
          to="/hausmeisterservice"
          className="btn-secondary-premium inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold sm:w-fit"
        >
          Objekt- & Hausmeisterservice im Detail
        </NavLink>
      </LazySection>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={280} delayMs={50}>
        {LEISTUNGEN.map((item) => (
          <article key={item.titel} className="premium-card p-5">
            <h2 className="text-xl font-semibold text-white">{item.titel}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{item.text}</p>
          </article>
        ))}
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={180} delayMs={65}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektCheck & laufende Betreuung</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Bestandsaufnahme als Einstieg in klare Objektbetreuung</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-soft)]">
          Der KusiPrimeTec ObjektCheck strukturiert sichtbare Mängel, Instandhaltungspunkte und sinnvolle nächste
          Schritte. Darauf kann eine planbare monatliche Betreuung mit digitaler Dokumentation aufbauen.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <NavLink to="/objektcheck" className="btn-primary-premium inline-flex min-h-12 items-center rounded-full px-5 py-3 text-sm font-semibold">
            Kostenlosen ObjektCheck starten
          </NavLink>
          <NavLink to="/objektbetreuung" className="btn-primary-premium inline-flex min-h-12 items-center rounded-full px-5 py-3 text-sm font-semibold">
            Objektbetreuung ansehen
          </NavLink>
          <NavLink to="/objektbetreuung-anfrage?auswahl=pro" className="btn-secondary-premium inline-flex min-h-12 items-center rounded-full px-5 py-3 text-sm font-semibold">
            Betreuung unverbindlich anfragen
          </NavLink>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={230} delayMs={80}>
        <h2 className="text-xl font-semibold text-white">Leistungsabgrenzung</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_SCOPE_NOTICE}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-300/30 bg-emerald-400/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Leistungsrahmen</p>
            <ul className="mt-2 grid gap-2 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_ERLAUBT.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
          </article>
          <article className="rounded-xl border border-rose-300/30 bg-rose-400/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">Qualifizierte Fachunternehmen</p>
            <ul className="mt-2 grid gap-2 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_NICHT.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </article>
        </div>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={200} delayMs={95}>
        <article className="premium-card page-card">
          <h2 className="text-xl font-semibold text-white">Projektkoordination externer Gewerke</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{KOORDINATION_RECHTSTEXT}</p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-semibold text-white">Qualitätsstandard im Tagesgeschäft</h2>
          <ul className="mt-4 grid gap-3">
            {PREMIUM_STANDARDS.map((point) => <li key={point} className="text-sm text-[var(--text-main)]">✓ {point}</li>)}
          </ul>
        </article>
      </LazySection>

      <section className="premium-card page-card" aria-labelledby="service-qualifications-heading">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Fachkompetenz</p>
        <h2 id="service-qualifications-heading" className="mt-2 text-xl font-semibold text-white md:text-2xl">
          Fachliche Grundlage unserer Leistungen
        </h2>
        <p className="mt-3 max-w-5xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          Die technische Betreuung erfolgt auf Grundlage einer abgeschlossenen Berufsausbildung als Elektroniker für
          Energie- und Gebäudetechnik, elf absolvierter ETZ-Lehrgänge sowie mehrjähriger praktischer Erfahrung im
          technischen Gebäudeservice. Arbeiten außerhalb des zulässigen Leistungsrahmens werden an entsprechend
          qualifizierte Fachbetriebe übergeben oder durch diese ausgeführt.
        </p>
      </section>

      <LazySection className="space-y-5" minHeight={520} delayMs={110}>
        <header>
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Häufige Fragen</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Leistungen und Abrechnung erklärt</h2>
        </header>
        <PricingFaq />
      </LazySection>
    </div>
  );
}
