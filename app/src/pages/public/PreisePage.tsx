import { LazySection } from "@/components/ui/LazySection";
import {
  PackageComparison,
  PackageGrid,
  PricingFaq,
  PublicPriceNotes,
  ServicePricingCards,
} from "@/components/public/PricingSections";
import { PUBLIC_PRICING, PUBLIC_SCOPE_NOTICE } from "@/config/publicServices";
import { useSeo } from "@/hooks/useSeo";
import { eur } from "@/lib/format";

export default function PreisePage() {
  useSeo({
    title: "Preise für technischen Immobilienservice | KusiPrimeTec",
    description:
      "Transparente Preise für technischen Störungsservice, Objekt- und Hausmeisterservice sowie monatliche Objektbetreuung im Raum Schorndorf.",
    canonicalPath: "/preise",
  });

  return (
    <div className="page-enter page-stack-large">
      <header className="premium-card premium-card-strong page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Transparente Preisstruktur</p>
        <h1 className="public-page-title mt-2 text-white">Technischer Service und Objektbetreuung klar kalkuliert</h1>
        <p className="public-page-lead mt-3 max-w-4xl">
          Zwei klar abgegrenzte Einzelleistungen und vier planbare Betreuungspakete für Gewerbeobjekte und
          Bestandsimmobilien. Leistungen, Zeit und Folgeschritte werden nachvollziehbar dokumentiert.
        </p>
      </header>

      <LazySection className="space-y-5" minHeight={440} delayMs={35}>
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Einzelaufträge</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Passender Service für den konkreten Bedarf</h2>
        </header>
        <ServicePricingCards />
        <article className="premium-card page-card">
          <h3 className="text-lg font-semibold text-white">Abrechnung und Einsatzpauschale</h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-main)]">{PUBLIC_PRICING.billingNotice}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
            Die bestehende Einsatzpauschale für Einzelaufträge beträgt {eur(PUBLIC_PRICING.serviceCallFlatEur)}.
            Beginn, Ende und Pausen werden dokumentiert. Größere oder nicht sicher abschätzbare Aufwände stimmen wir
            vorab ab.
          </p>
        </article>
      </LazySection>

      <LazySection className="space-y-5" minHeight={760} delayMs={55}>
        <header className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Monatliche Objektbetreuung</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Vier Pakete für klare Betreuungsstrukturen</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Basis schafft einen planbaren Einstieg, Business deckt wiederkehrenden Bedarf ab, Pro ist die
            ausgewogene Standardlösung und Priority ergänzt mehr Reserve, Termine und Priorisierung.
          </p>
        </header>
        <PackageGrid />
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={500} delayMs={70}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Direkter Vergleich</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Leistungsumfang auf einen Blick</h2>
        <p className="mt-2 mb-5 max-w-3xl text-sm text-[var(--text-soft)]">
          Auf kleineren Bildschirmen lassen sich die Pakete einzeln aufklappen. Auf großen Bildschirmen steht die
          vollständige Vergleichstabelle zur Verfügung.
        </p>
        <PackageComparison />
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={300} delayMs={85}>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Zusatzstunden nach Freigabe</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-main)]">{PUBLIC_PRICING.additionalHoursNotice}</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_PRICING.additionalHoursLimits}</p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Preis- und Anfahrtshinweise</h2>
          <div className="mt-3">
            <PublicPriceNotes />
          </div>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={180} delayMs={95}>
        <h2 className="text-xl font-bold text-white">Leistungsabgrenzung</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">{PUBLIC_SCOPE_NOTICE}</p>
      </LazySection>

      <LazySection className="space-y-5" minHeight={520} delayMs={110}>
        <header>
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Häufige Fragen</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Preise und Leistungsrahmen verständlich erklärt</h2>
        </header>
        <PricingFaq />
      </LazySection>
    </div>
  );
}
