import { LazySection } from "@/components/ui/LazySection";
import { OBJECT_CARE_PACKAGES, PUBLIC_OFFER_CONFIG } from "@/data/publicWebsite";
import { PREISE } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function PreisePage() {
  useSeo({
    title: "Preisübersicht für ObjektBetreuung, ObjektCheck und Einzelaufträge | KusiPrimeTec",
    description:
      "Öffentliche Preisübersicht von KusiPrimeTec: ObjektBetreuung ab 399 € pro Monat, ObjektCheck Gewerbe für 249 €, Einzelaufträge mit 80 € pro Stunde und 39 € Einsatzpauschale.",
    canonicalPath: "/preise",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Öffentliche Preisübersicht
          </p>
          <h1 className="hero-display text-white">Klare Preislogik für Betreuung, Einstieg und Einzelthemen.</h1>
          <p className="hero-support text-electric-100">
            KusiPrimeTec unterscheidet bewusst zwischen laufender ObjektBetreuung, kostenpflichtigem ObjektCheck und operativen Einzelaufträgen.
          </p>
        </div>
      </section>

      <LazySection className="grid gap-4 lg:grid-cols-3" minHeight={220} delayMs={35}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektBetreuung</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Ab 399 € pro Monat</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Monatliche Betreuung mit festem Ansprechpartner, Kontingent, Dokumentation und geplanter Taktung. Das Plus-Paket für 599 € pro Monat bleibt die empfohlene Hauptvariante.
          </p>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektCheck Gewerbe</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{PUBLIC_OFFER_CONFIG.objectCheck.priceLabel}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Kostenpflichtiger Einstieg mit strukturierter Aufnahme sichtbarer technischer Auffälligkeiten, Fotodokumentation und Handlungsempfehlung. Für größere Objekte nach Aufwand.
          </p>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Einzelauftrag</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{PREISE.stundensatz} € / Stunde</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Zusätzlich {PREISE.einsatzpauschale} € Einsatzpauschale. {PREISE.abrechnungshinweis}
          </p>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={320} delayMs={50}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektBetreuung im Überblick</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Pakete für laufende Betreuung</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {OBJECT_CARE_PACKAGES.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-4 ${item.featured ? "border-electric-300/55 bg-electric-400/10" : "border-[var(--line)] bg-slate-950/35"}`}>
              {item.featured ? (
                <p className="mb-2 inline-flex rounded-full border border-electric-200/45 bg-electric-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
                  Empfohlen
                </p>
              ) : null}
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{item.name}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.priceLabel}</p>
              <p className="mt-1 text-sm text-electric-100">{item.hoursLabel}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{item.cadenceLabel}</p>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={220} delayMs={65}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Zusatzarbeiten in aktiver Betreuung</p>
          <h2 className="mt-2 text-xl font-bold text-white">60 € pro Stunde nach vorheriger Abstimmung</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Zusatzarbeiten außerhalb des laufenden Betreuungskontingents werden nur nach Abstimmung eingeplant. Material, Ersatzteile und Fremdleistungen werden separat berechnet.
          </p>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Projektkoordination</p>
          <h2 className="mt-2 text-xl font-bold text-white">{PUBLIC_OFFER_CONFIG.projectCoordination.priceLabel}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            {PUBLIC_OFFER_CONFIG.projectCoordination.note}
          </p>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={180} delayMs={80}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Zuschläge</p>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">
          {PREISE.zuschlaege.map((item) => (
            <li key={item.label} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-slate-950/35 px-4 py-3">
              <span>{item.label}</span>
              <strong className="text-white">{item.value}</strong>
            </li>
          ))}
        </ul>
      </LazySection>
    </div>
  );
}
