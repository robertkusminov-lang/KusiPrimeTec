import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import {
  PackageComparison,
  PackageGrid,
  PublicPriceNotes,
} from "@/components/public/PricingSections";
import { PUBLIC_PRICING, PUBLIC_SCOPE_NOTICE } from "@/config/publicServices";
import { useSeo } from "@/hooks/useSeo";

const benefits = [
  "Fester technischer Ansprechpartner für definierte Objekte",
  "Planbare monatliche Kosten und klare Kontingente",
  "Technische Kontrollgänge und Sichtkontrollen",
  "Geeignete Kleinreparaturen im zulässigen Rahmen",
  "Digitale Einsatzrapporte und nachvollziehbare Maßnahmen",
  "Koordination externer Fachunternehmen bei Bedarf",
];

export default function ObjektbetreuungPage() {
  useSeo({
    title: "Monatliche Objektbetreuung | KusiPrimeTec Schorndorf",
    description:
      "Planbare technische Objektbetreuung und geeignete Hausmeisterleistungen mit vier transparenten Paketen für Gewerbeobjekte und Bestandsimmobilien.",
    canonicalPath: "/objektbetreuung",
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Technische Objektbetreuung
          </p>
          <h1 className="hero-display text-white">Planbare Betreuung für Gebäude im laufenden Betrieb</h1>
          <p className="hero-support text-electric-100">
            Technische Objektbetreuung und geeignete Hausmeisterleistungen mit festen Kontingenten, dokumentierten
            Einsätzen und einem direkten Ansprechpartner.
          </p>
          <p className="public-page-lead max-w-4xl">
            KusiPrimeTec bündelt Kontrollgänge, Mängelaufnahme, geeignete Kleinreparaturen, Störungsaufnahme und
            organisatorische Folgeschritte in einer klaren monatlichen Struktur. So bleiben Zustand, Aufwand und
            offene Maßnahmen für Unternehmen, Eigentümer und Verwaltungen nachvollziehbar.
          </p>
          <div className="flex flex-wrap gap-3">
            <NavLink
              to="/objektbetreuung-anfrage?auswahl=pro"
              className="btn-primary-premium inline-flex min-h-12 items-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              Pro unverbindlich anfragen
            </NavLink>
            <NavLink
              to="/preise"
              className="btn-secondary-premium inline-flex min-h-12 items-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              Preise vergleichen
            </NavLink>
          </div>
        </div>
      </section>

      <LazySection className="premium-card page-card-lg" minHeight={230} delayMs={35}>
        <h2 className="text-2xl font-bold text-white md:text-3xl">Was laufende Objektbetreuung verbessert</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((item) => (
            <div key={item} className="rounded-xl border border-electric-300/20 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-[var(--text-main)]">
              <span className="mr-2 text-electric-300" aria-hidden="true">✓</span>{item}
            </div>
          ))}
        </div>
      </LazySection>

      <LazySection className="space-y-5" minHeight={760} delayMs={55}>
        <header className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Betreuungspakete</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Vom planbaren Einstieg bis zur maximalen Priorisierung</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Alle Pakete kombinieren technische Objektbetreuung mit geeigneten Objekt- und Hausmeisterleistungen.
            Objekt Pro ist als ausgewogene Standardlösung hervorgehoben.
          </p>
        </header>
        <PackageGrid />
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={500} delayMs={70}>
        <h2 className="text-2xl font-bold text-white md:text-3xl">Pakete vollständig vergleichen</h2>
        <p className="mt-2 mb-5 text-sm text-[var(--text-soft)]">
          Kontingent, Objekte, Termine, Reaktionsreserve, Dokumentation und Übertragung sind direkt vergleichbar.
        </p>
        <PackageComparison />
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={280} delayMs={85}>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Zusätzliche Betreuungsstunden</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-main)]">{PUBLIC_PRICING.additionalHoursNotice}</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_PRICING.additionalHoursLimits}</p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Klare Preis- und Anfahrtsregel</h2>
          <div className="mt-3"><PublicPriceNotes /></div>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={180} delayMs={100}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsabgrenzung</p>
        <h2 className="mt-2 text-xl font-bold text-white">Technischer Service im zulässigen Rahmen</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">{PUBLIC_SCOPE_NOTICE}</p>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg text-center" minHeight={180} delayMs={115}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Nächster Schritt</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Passendes Betreuungspaket besprechen</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-soft)]">
          Die Auswahl wird automatisch in das Anfrageformular übernommen und bleibt dort sichtbar.
        </p>
        <NavLink
          to="/objektbetreuung-anfrage?auswahl=pro"
          className="btn-primary-premium mt-5 inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
        >
          Betreuung unverbindlich anfragen
        </NavLink>
      </LazySection>
    </div>
  );
}
