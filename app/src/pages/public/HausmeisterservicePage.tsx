import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { PublicPriceNotes } from "@/components/public/PricingSections";
import {
  PUBLIC_PRICING,
  PUBLIC_SCOPE_NOTICE,
  PUBLIC_SERVICES,
} from "@/config/publicServices";
import { useSeo } from "@/hooks/useSeo";
import { eur } from "@/lib/format";

const service = PUBLIC_SERVICES.find((item) => item.id === "hausmeisterservice")!;

export default function HausmeisterservicePage() {
  useSeo({
    title: "Objekt- & Hausmeisterservice in Schorndorf | KusiPrimeTec",
    description:
      "Kontrollgänge, Kleinreparaturen, Mängelaufnahme und laufende Objektunterstützung durch KusiPrimeTec im Raum Schorndorf.",
    canonicalPath: "/hausmeisterservice",
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Ergänzend zum technischen Immobilienservice
          </p>
          <h1 className="hero-display text-white">Objekt- & Hausmeisterservice</h1>
          <p className="hero-support text-electric-100">{service.description}</p>
          <p className="text-3xl font-extrabold text-white md:text-4xl">
            {eur(service.priceEur)}
            <span className="ml-2 text-base font-semibold text-electric-100">/ Arbeitsstunde</span>
          </p>
          <p className="text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_PRICING.billingNotice}</p>
          <NavLink
            to="/objektbetreuung-anfrage?auswahl=hausmeisterservice"
            className="btn-primary-premium inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 py-3 text-center text-sm font-semibold sm:w-fit"
          >
            {service.cta}
          </NavLink>
        </div>
      </section>

      <LazySection className="premium-card page-card-lg" minHeight={360} delayMs={35}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsbeispiele</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Strukturierte Unterstützung rund um das Objekt</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {service.features.map((feature) => (
            <div key={feature} className="rounded-xl border border-electric-300/20 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-main)]">
              <span className="mr-2 text-electric-300" aria-hidden="true">✓</span>{feature}
            </div>
          ))}
          <div className="rounded-xl border border-electric-300/20 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-main)]">
            <span className="mr-2 text-electric-300" aria-hidden="true">✓</span>
            Wechsel und Nachfüllen geeigneter Verbrauchsmaterialien
          </div>
          <div className="rounded-xl border border-electric-300/20 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-main)]">
            <span className="mr-2 text-electric-300" aria-hidden="true">✓</span>
            Türen, Beschläge, Möbel, Regale und geeignete Leuchtmittel
          </div>
        </div>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={260} delayMs={55}>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Transparente Abrechnung</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-main)]">{PUBLIC_PRICING.billingNotice}</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Beginn, Ende und Pausen werden dokumentiert. Bei größerem oder nicht sicher abschätzbarem Aufwand erfolgt
            vorab eine Abstimmung.
          </p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Preis- und Anfahrtshinweise</h2>
          <div className="mt-3"><PublicPriceNotes /></div>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={180} delayMs={70}>
        <h2 className="text-xl font-bold text-white">Leistungsabgrenzung</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">{PUBLIC_SCOPE_NOTICE}</p>
      </LazySection>
    </div>
  );
}
