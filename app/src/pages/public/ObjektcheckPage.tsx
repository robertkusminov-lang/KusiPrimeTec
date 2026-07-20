import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import {
  OBJECT_CHECK_EXCLUSIONS,
  OBJECT_CHECK_FEATURES,
  OBJECT_CHECK_RESULTS,
  PUBLIC_OFFER_CONFIG,
} from "@/data/publicWebsite";
import { useSeo } from "@/hooks/useSeo";
import { buildServiceSchema, ORGANIZATION_SCHEMA } from "@/lib/seoData";

const targetUseCases = [
  "Sie möchten sichtbare technische Auffälligkeiten strukturiert erfassen lassen.",
  "Mehrere Kleinthemen sollen vor einer laufenden Betreuung geordnet werden.",
  "Für Eigentum, Verwaltung oder Betrieb braucht es eine klare erste Priorisierung.",
  "Sie möchten erkennen, was KusiPrimeTec direkt übernehmen kann und wo eine Fachfirma nötig ist.",
] as const;

export default function ObjektcheckPage() {
  useSeo({
    title: "ObjektCheck Gewerbe | KusiPrimeTec",
    description:
      "ObjektCheck Gewerbe von KusiPrimeTec: strukturierte Bestandsaufnahme sichtbarer technischer Auffälligkeiten mit Fotodokumentation, Priorisierung und kompakter Maßnahmenübersicht für 249 €.",
    canonicalPath: "/objektcheck",
    structuredData: [
      ORGANIZATION_SCHEMA,
      buildServiceSchema({
        name: "ObjektCheck Gewerbe",
        description:
          "Kostenpflichtige Bestandsaufnahme sichtbarer technischer Auffälligkeiten mit Fotodokumentation, Priorisierung und Handlungsempfehlung.",
        urlPath: "/objektcheck",
        offers: [
          {
            name: "ObjektCheck Gewerbe",
            description:
              "Bis zu 90 Minuten Vor-Ort-Begehung mit strukturierter Aufnahme sichtbarer Auffälligkeiten und digitaler Maßnahmenübersicht.",
            price: PUBLIC_OFFER_CONFIG.objectCheck.priceEur,
          },
        ],
      }),
    ],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Einstiegsprodukt ObjektCheck
          </p>
          <h1 className="hero-display text-white">ObjektCheck Gewerbe für einen sauberen Überblick vor der nächsten Entscheidung.</h1>
          <p className="hero-support text-electric-100">
            Der ObjektCheck ist der strukturierte Einstieg für sichtbare technische Auffälligkeiten im Bestand – mit Fotodokumentation, Priorisierung und kompakter Maßnahmenübersicht.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <NavLink
              to="/objektbetreuung-anfrage?anliegen=objektcheck"
              className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              ObjektCheck anfragen
            </NavLink>
            <NavLink
              to="/objektbetreuung"
              className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              ObjektBetreuung ansehen
            </NavLink>
          </div>
        </div>
      </section>

      <LazySection className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]" minHeight={260} delayMs={35}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Preis</p>
          <h2 className="mt-2 text-3xl font-extrabold text-white">{PUBLIC_OFFER_CONFIG.objectCheck.priceLabel}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_OFFER_CONFIG.objectCheck.largerObjectNote}</p>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Wofür der ObjektCheck gedacht ist</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Geeignet für Unternehmen, Verwaltungen und Eigentümer mit Klärungsbedarf im Bestand.</h2>
          <div className="mt-4 grid gap-3">
            {targetUseCases.map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-3 text-sm text-[var(--text-main)]">
                {item}
              </div>
            ))}
          </div>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={50}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Enthaltene Leistungen</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Was im ObjektCheck enthalten ist</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {OBJECT_CHECK_FEATURES.map((item) => (
            <article key={item} className="premium-card border border-electric-300/20 p-4 text-sm text-[var(--text-main)]">
              {item}
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={240} delayMs={65}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ergebnis</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Was Sie danach erhalten</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
            {OBJECT_CHECK_RESULTS.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Nicht enthalten</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Der ObjektCheck ersetzt keine fachliche Prüfung.</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
            {OBJECT_CHECK_EXCLUSIONS.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={220} delayMs={80}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Übergang zur Betreuung</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Aus dem ObjektCheck kann direkt ein sauberer Betreuungsplan entstehen.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          Wenn aus dem ObjektCheck wiederkehrende Themen, laufende Mängel oder koordinationsintensive Kleinthemen sichtbar werden, kann daraus direkt eine passende ObjektBetreuung oder ein individuelles Betreuungskonzept entwickelt werden.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektcheck"
            className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektCheck anfragen
          </NavLink>
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektbetreuung"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektBetreuung besprechen
          </NavLink>
        </div>
      </LazySection>
    </div>
  );
}
