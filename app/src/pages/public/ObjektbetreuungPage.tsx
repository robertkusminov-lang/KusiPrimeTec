import { NavLink } from "react-router-dom";
import { Accordion } from "@/components/ui/Accordion";
import { LazySection } from "@/components/ui/LazySection";
import {
  OBJECT_CARE_EXTRA_RULES,
  OBJECT_CARE_FAQS,
  OBJECT_CARE_INCLUDED,
  OBJECT_CARE_PACKAGES,
  OBJECT_CARE_RULES,
  OBJECT_CARE_TARGET_GROUPS,
  PROBLEM_POINTS,
  PUBLIC_OFFER_CONFIG,
} from "@/data/publicWebsite";
import { useSeo } from "@/hooks/useSeo";
import { buildServiceSchema, ORGANIZATION_SCHEMA } from "@/lib/seoData";

const documentationPoints = [
  "Digitale Tickets mit Kunden- und Objektzuordnung",
  "Nachvollziehbare Rapport- und Fotodokumentation",
  "Priorisierte Mängel- und Maßnahmenübersicht",
  "Klare Rückmeldungen an Ansprechpartner, Verwaltung oder Eigentum",
  "Saubere Vorbereitung für weiterführende Fachfirmen",
] as const;

const limits = [
  "Keine garantierte Sofortverfügbarkeit oder 24/7-Notdienst",
  "Keine gesetzliche Prüfung, Abnahme oder eigenverantwortliche Errichtung elektrotechnischer Anlagen",
  "Fachpflichtige Arbeiten werden nicht als eigene Ausführung angeboten",
  "Fachliche Verantwortung, Ausführung und Gewährleistung verbleiben bei beauftragten Fachunternehmen",
] as const;

export default function ObjektbetreuungPage() {
  useSeo({
    title: "ObjektBetreuung für Gewerbeobjekte und Bestandsimmobilien | KusiPrimeTec",
    description:
      "ObjektBetreuung als Kernangebot von KusiPrimeTec: planbare technische Entlastung mit festem Ansprechpartner, monatlichem Kontingent, digitaler Dokumentation und koordinierter Fachfirmensteuerung.",
    canonicalPath: "/objektbetreuung",
    structuredData: [
      ORGANIZATION_SCHEMA,
      buildServiceSchema({
        name: "ObjektBetreuung",
        description:
          "Planbare technische Entlastung mit festem Ansprechpartner, geplanten Sammelterminen, dokumentierten Abläufen und koordinierter Nachverfolgung offener Punkte.",
        urlPath: "/objektbetreuung",
        offers: OBJECT_CARE_PACKAGES.map((pkg) => ({
          name: pkg.name,
          description: `${pkg.hoursLabel} und ${pkg.cadenceLabel}.`,
          ...(pkg.priceEur ? { price: pkg.priceEur } : {}),
        })),
      }),
    ],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Kernprodukt ObjektBetreuung
          </p>
          <h1 className="hero-display text-white">Planbare technische Entlastung mit festem Ansprechpartner und dokumentiertem Ablauf.</h1>
          <p className="hero-support text-electric-100">
            Die ObjektBetreuung ist das zentrale Angebot von KusiPrimeTec für Gewerbeobjekte und Bestandsimmobilien mit wiederkehrenden technischen Themen im laufenden Betrieb.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <NavLink
              to="/objektbetreuung-anfrage?anliegen=objektbetreuung"
              className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              ObjektBetreuung anfragen
            </NavLink>
            <NavLink
              to="/objektcheck"
              className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              ObjektCheck als Einstieg ansehen
            </NavLink>
          </div>
        </div>
      </section>

      <LazySection className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]" minHeight={260} delayMs={35}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Geeignet für</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Welche Kunden besonders profitieren</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {OBJECT_CARE_TARGET_GROUPS.map((group) => (
              <span key={group} className="rounded-full border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-sm text-[var(--text-main)]">
                {group}
              </span>
            ))}
          </div>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Typische Ausgangslage</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Wenn Kleinthemen immer wieder Zeit und Übersicht kosten.</h2>
          <div className="mt-4 grid gap-3">
            {PROBLEM_POINTS.map((point) => (
              <div key={point} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-3 text-sm text-[var(--text-main)]">
                {point}
              </div>
            ))}
          </div>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={50}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Enthaltene Leistungen</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Was die ObjektBetreuung im Alltag leistet</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {OBJECT_CARE_INCLUDED.map((item) => (
            <article key={item} className="premium-card border border-electric-300/20 p-4 text-sm text-[var(--text-main)]">
              {item}
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={260} delayMs={65}>
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Digitale Dokumentation</p>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Nicht nur erledigen, sondern nachvollziehbar festhalten.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              Die ObjektBetreuung verbindet praktische Bestandsarbeit mit strukturierter Dokumentation, damit offene Punkte, Maßnahmen und Rückmeldungen nicht im Tagesgeschäft verloren gehen.
            </p>
          </div>
          <div className="grid gap-3">
            {documentationPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-[var(--line)] bg-slate-950/40 px-4 py-3 text-sm text-[var(--text-main)]">
                {point}
              </div>
            ))}
          </div>
        </div>
      </LazySection>

      <LazySection className="space-y-5" minHeight={520} delayMs={80}>
        <header className="max-w-4xl space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Pakete</p>
          <h2 className="text-2xl font-bold text-white md:text-3xl">Vier Betreuungsmodelle für unterschiedliche Objektgrößen.</h2>
          <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Das Plus-Paket ist das empfohlene Hauptpaket für laufende Gewerbe- und Bestandsbetreuung. Individuelle Konzepte bleiben für mehrere Standorte oder besondere Taktungen möglich.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {OBJECT_CARE_PACKAGES.map((pkg) => (
            <article
              key={pkg.id}
              className={`premium-card relative flex h-full flex-col p-5 ${pkg.featured ? "border-electric-300/60 bg-electric-400/10" : "border-[var(--line)]"}`}
            >
              {pkg.featured ? (
                <span className="absolute right-4 top-4 rounded-full border border-electric-200/45 bg-electric-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
                  Empfohlen
                </span>
              ) : null}
              <p className="pr-24 text-xs uppercase tracking-[0.12em] text-electric-300">{pkg.name}</p>
              <p className="mt-3 text-3xl font-extrabold text-white">{pkg.priceLabel}</p>
              <p className="mt-1 text-sm font-semibold text-electric-100">{pkg.hoursLabel}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{pkg.cadenceLabel}</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">{pkg.audience}</p>
              <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
                {pkg.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-electric-300">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={320} delayMs={95}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Pilotphase und Vertragslogik</p>
          <h2 className="mt-2 text-xl font-bold text-white">Planbar starten, sauber weiterführen.</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
            {OBJECT_CARE_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Zusatzleistungen</p>
          <h2 className="mt-2 text-xl font-bold text-white">Zusätzliche Arbeiten bleiben abstimmbar.</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
            {OBJECT_CARE_EXTRA_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={240} delayMs={110}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsabgrenzung und Fachfirmenkoordination</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Klare Grenzen schützen die Zusammenarbeit.</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">{PUBLIC_OFFER_CONFIG.scope.summary}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {limits.map((item) => (
            <article key={item} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              {item}
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {PUBLIC_OFFER_CONFIG.projectCoordination.includes.slice(0, 6).map((item) => (
            <article key={item} className="rounded-2xl border border-electric-300/20 bg-slate-950/40 px-4 py-4 text-sm text-[var(--text-main)]">
              {item}
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_OFFER_CONFIG.projectCoordination.note}</p>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={240} delayMs={125}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Häufige Fragen</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Was Kunden vor dem Einstieg meist wissen möchten</h2>
        <div className="mt-5 grid gap-3">
          {OBJECT_CARE_FAQS.map((faq) => (
            <Accordion key={faq.question} title={faq.question}>
              <p className="text-sm leading-relaxed text-[var(--text-soft)]">{faq.answer}</p>
            </Accordion>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg text-center" minHeight={190} delayMs={140}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Anfrage</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">ObjektBetreuung jetzt sauber anstoßen</h2>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          Beschreiben Sie Objekt, Ansprechpartner und gewünschten Umfang. Die Anfrage läuft weiterhin getrennt vom operativen Ticket-Flow als Interessenten- und Beratungsprozess.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektbetreuung"
            className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektBetreuung anfragen
          </NavLink>
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=individuell"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            Individuelles Konzept besprechen
          </NavLink>
        </div>
      </LazySection>
    </div>
  );
}
