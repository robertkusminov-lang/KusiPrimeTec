import { LazySection } from "@/components/ui/LazySection";
import { BUSINESS_RULES } from "@/config/businessRules";
import { PREISE } from "@/data/content";
import { eur } from "@/lib/format";
import { useSeo } from "@/hooks/useSeo";

const objektPakete = [
  { name: "Objektbetreuung Start", price: "489 € / Monat", hours: "inkl. 8 Stunden Betreuungskontingent" },
  { name: "Objektbetreuung Plus", price: "729 € / Monat", hours: "inkl. 12 Stunden Betreuungskontingent", featured: true },
  { name: "Objektbetreuung Premium", price: "969 € / Monat", hours: "inkl. 16 Stunden Betreuungskontingent" },
  { name: "Objektbetreuung Individuell", price: "individuell kalkuliert", hours: "Leistungsumfang nach Objekt, Intervall und Bedarf abgestimmt" },
];

export default function PreisePage() {
  useSeo({
    title: "Technischer Immobilienservice & Objektbetreuung | Preise",
    description: `Transparente Preisstruktur für technischen Service und Objektbetreuung in Schorndorf: ${BUSINESS_RULES.pricing.hourlyRateEur} € pro Stunde, ${BUSINESS_RULES.pricing.serviceCallFlatEur} € Einsatzpauschale und klare Objektbetreuung-Pakete.`,
  });

  return (
    <div className="page-enter page-stack">
      <header className="premium-card page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Preisstruktur</p>
        <h1 className="public-page-title mt-2 text-white">Transparente Konditionen für Objektbetreuung und Service im Bestand</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Klare Sätze, nachvollziehbare Zuschläge und saubere Dokumentation als Grundlage für planbare Betreuung und belastbare Entscheidungen.
        </p>
      </header>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={220} delayMs={50}>
        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Einzelleistungen</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-soft)]">
            <li className="flex items-center justify-between gap-2"><span>Stundensatz</span><strong className="text-white">{eur(PREISE.stundensatz)}</strong></li>
            <li className="flex items-center justify-between gap-2"><span>Einsatzpauschale</span><strong className="text-white">{eur(PREISE.einsatzpauschale)}</strong></li>
          </ul>
          <p className="mt-3 text-xs text-[var(--text-soft)]">{PREISE.abrechnungshinweis}</p>
        </article>

        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Zuschläge</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-soft)]">
            {PREISE.zuschlaege.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-2"><span>{item.label}</span><strong className="text-white">{item.value}</strong></li>
            ))}
          </ul>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={220} delayMs={70}>
        <h2 className="text-lg font-semibold text-white">Objektbetreuung-Pakete</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Feste monatliche Betreuung für Gewerbeobjekte und Bestandsimmobilien. Für besondere Anforderungen kann zusätzlich ein individuelles Betreuungskonzept erstellt werden.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {objektPakete.map((item) => (
            <article key={item.name} className={`rounded-2xl border bg-slate-950/40 p-4 ${item.featured ? "border-electric-300/60" : "border-[var(--line)]"}`}>
              {item.featured ? <p className="mb-2 inline-flex rounded-full border border-electric-200/45 bg-electric-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">Empfohlen</p> : null}
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{item.name}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.price}</p>
              <p className="mt-1 text-sm text-electric-100">{item.hours}</p>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={180} delayMs={80}>
        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Zusatzleistungen bei aktiver Objektbetreuung</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Zusätzliche Arbeiten außerhalb des vereinbarten Betreuungskontingents werden nur nach vorheriger Abstimmung eingeplant. Material, Ersatzteile und Fremdleistungen werden separat berechnet.
          </p>
        </article>
        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Projektkoordination</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{PREISE.projektkoordination}</p>
        </article>
      </LazySection>
    </div>
  );
}
