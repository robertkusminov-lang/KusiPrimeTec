import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { ABLAUF } from "@/data/content";
import { BUSINESS_RULES, COMPANY_PROFILE } from "@/config/businessRules";
import {
  BUSINESS_MODEL_PROMISES,
  DIGITAL_WORKFLOW_FEATURES,
  OBJECT_CARE_INCLUDED,
  OBJECT_CARE_PACKAGES,
  OBJECT_CARE_TARGET_GROUPS,
  OBJECT_CHECK_RESULTS,
  PROBLEM_POINTS,
  PUBLIC_OFFER_CONFIG,
} from "@/data/publicWebsite";
import { useSeo } from "@/hooks/useSeo";
import { buildServiceSchema, ORGANIZATION_SCHEMA } from "@/lib/seoData";

const trustSignals = [
  "Persönlicher Ansprechpartner",
  "Rückmeldung innerhalb von 24 Stunden",
  "Dokumentierte Leistungen",
  "30 km Einsatzradius",
  "Klare Leistungsabgrenzung",
] as const;

const digitalBoardCards = [
  {
    title: "Ticket erfasst",
    meta: "Objekt · Ansprechpartner · Priorität",
    lines: ["Ticketnummer eindeutig zugeordnet", "Klare Zuständigkeit", "Dokumentierter Eingang"],
  },
  {
    title: "Bearbeitung nachvollziehbar",
    meta: "Zeit · Material · Rückmeldung",
    lines: ["Arbeitszeit dokumentiert", "Materialübersicht festgehalten", "Status sauber fortgeschrieben"],
  },
  {
    title: "Rapport digital verfügbar",
    meta: "Foto · Ergebnis · Bestätigung",
    lines: ["Fotodokumentation", "Ergebnisbericht", "Kundenbestätigung und Portalzugriff"],
  },
] as const;

export default function HomePage() {
  useSeo({
    title: "Technik im Bestand. Klar betreut. Sauber dokumentiert. | KusiPrimeTec",
    description:
      "KusiPrimeTec unterstützt Unternehmen, Verwaltungen und Eigentümer bei wiederkehrenden technischen Themen im Gebäudebestand mit persönlicher ObjektBetreuung, strukturierten Abläufen und digitaler Dokumentation.",
    canonicalPath: "/",
    structuredData: [
      ORGANIZATION_SCHEMA,
      buildServiceSchema({
        name: "ObjektBetreuung und technischer Immobilienservice",
        description:
          "Planbare technische Entlastung für Gewerbeobjekte und Bestandsimmobilien mit persönlicher Betreuung, digitaler Dokumentation und koordinierter Nachverfolgung offener Punkte.",
        urlPath: "/objektbetreuung",
      }),
      buildServiceSchema({
        name: "ObjektCheck Gewerbe",
        description:
          "Strukturierte Aufnahme sichtbarer technischer Auffälligkeiten mit Fotodokumentation, Priorisierung und kompakter Maßnahmenübersicht.",
        urlPath: "/objektcheck",
        offers: [
          {
            name: "ObjektCheck Gewerbe",
            description:
              "Bis zu 90 Minuten Vor-Ort-Begehung mit strukturierter Bestandsaufnahme, Fotodokumentation und Handlungsempfehlung.",
            price: PUBLIC_OFFER_CONFIG.objectCheck.priceEur,
          },
        ],
      }),
    ],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="hero-bg-shift premium-card premium-card-strong page-card-hero relative overflow-hidden">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/64 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
              Technischer Immobilienservice · Schorndorf & 30 km Umgebung
            </p>
            <h1 className="hero-display max-w-4xl text-white">Technik im Bestand. Klar betreut. Sauber dokumentiert.</h1>
            <p className="hero-support text-electric-100">
              KusiPrimeTec unterstützt Unternehmen, Verwaltungen und Eigentümer bei wiederkehrenden technischen Themen im Gebäudebestand – mit persönlicher ObjektBetreuung, strukturierten Abläufen und digitaler Dokumentation.
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
                ObjektCheck kennenlernen
              </NavLink>
              <NavLink to="/einzelauftrag" className="inline-flex min-h-[54px] items-center text-sm font-semibold text-electric-200 underline-offset-4 hover:text-white hover:underline">
                Einzelauftrag anfragen
              </NavLink>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-3">
              {trustSignals.map((signal) => (
                <div key={signal} className="rounded-2xl border border-electric-300/20 bg-slate-950/40 px-4 py-3 text-sm text-[var(--text-main)]">
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <article className="premium-card border border-electric-300/25 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Wofür KusiPrimeTec steht</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Planbare technische Entlastung statt lose Einzelthemen.</h2>
              <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
                {BUSINESS_MODEL_PROMISES.slice(0, 5).map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-electric-300">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="premium-card border border-electric-300/20 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Geeignet für</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {OBJECT_CARE_TARGET_GROUPS.slice(0, 6).map((group) => (
                  <span key={group} className="rounded-full border border-[var(--line)] bg-slate-950/45 px-3 py-1 text-xs text-[var(--text-main)]">
                    {group}
                  </span>
                ))}
              </div>
            </article>

            <article className="premium-card border border-electric-300/20 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Kundenlogin</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
                Bestehende Kunden nutzen den Kundenlogin für zugewiesene Objekte, Tickets, Rapporte und die laufende Dokumentation.
              </p>
              <NavLink
                to="/konto/anmelden"
                className="btn-secondary-premium mt-4 inline-flex min-h-[50px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
              >
                Kundenlogin öffnen
              </NavLink>
            </article>
          </div>
        </div>
      </section>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={40}>
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Problemverständnis</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Kleine technische Themen werden schnell zu großen organisatorischen Aufgaben.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              KusiPrimeTec bündelt technische Kleinthemen, priorisiert offene Punkte und schafft einen nachvollziehbaren Ablauf von der Meldung bis zum Rapport.
            </p>
          </div>
          <div className="grid gap-3">
            {PROBLEM_POINTS.map((point) => (
              <article key={point} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4">
                <p className="text-sm leading-relaxed text-[var(--text-main)]">{point}</p>
              </article>
            ))}
          </div>
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={360} delayMs={55}>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Hauptangebot</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">ObjektBetreuung als zentrales Angebot für laufende technische Entlastung.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              Im Mittelpunkt steht nicht die einzelne Reparatur, sondern ein sauberer Ablauf mit fester Betreuung, dokumentierten Rückmeldungen und klaren nächsten Schritten.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {OBJECT_CARE_INCLUDED.map((item) => (
                <div key={item} className="rounded-2xl border border-electric-300/20 bg-slate-950/40 px-4 py-4 text-sm text-[var(--text-main)]">
                  {item}
                </div>
              ))}
            </div>
            <NavLink
              to="/objektbetreuung"
              className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              ObjektBetreuung ansehen
            </NavLink>
          </div>

          <article className="premium-card border border-electric-300/25 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Betreuungsstufen im Überblick</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Kompakter Einstieg statt vier voller Preiskarten.</h3>
              </div>
              <span className="rounded-full border border-electric-200/45 bg-electric-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
                Plus empfohlen
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {OBJECT_CARE_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-2xl border px-4 py-4 ${pkg.featured ? "border-electric-300/45 bg-electric-400/10" : "border-[var(--line)] bg-slate-950/35"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{pkg.name}</p>
                      <p className="mt-1 text-sm text-electric-100">{pkg.hoursLabel}</p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">{pkg.cadenceLabel}</p>
                    </div>
                    <p className="text-sm font-semibold text-white">{pkg.priceLabel}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-[var(--text-soft)]">
              Start ab 399 € pro Monat, Plus als empfohlene Hauptvariante und individuelle Modelle für mehrere Standorte oder besondere Betriebszeiten.
            </p>
          </article>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={240} delayMs={70}>
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektCheck</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">ObjektCheck als strukturierter Einstieg.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              {PUBLIC_OFFER_CONFIG.objectCheck.priceLabel} – strukturierte Aufnahme sichtbarer technischer Auffälligkeiten mit Fotodokumentation, Priorisierung und kompakter Maßnahmenübersicht.
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-soft)]">{PUBLIC_OFFER_CONFIG.objectCheck.largerObjectNote}</p>
          </div>
          <div className="premium-card border border-electric-300/25 p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Was Sie erhalten</p>
            <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
              {OBJECT_CHECK_RESULTS.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-electric-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <NavLink
              to="/objektbetreuung-anfrage?anliegen=objektcheck"
              className="btn-secondary-premium mt-5 inline-flex min-h-[52px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
            >
              ObjektCheck anfragen
            </NavLink>
          </div>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={85}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ablauf</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Von der Meldung bis zum dokumentierten Ergebnis.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ABLAUF.map((step, index) => (
            <article key={step} className="premium-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric-300">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{step}</h3>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={320} delayMs={100}>
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Digitale Arbeitsweise</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Digital organisiert statt lose dokumentiert.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              Digitale Tickets, eindeutige Zuordnungen und saubere Rapporte schaffen Transparenz für Unternehmen, Verwaltungen und Eigentümer.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {DIGITAL_WORKFLOW_FEATURES.map((item) => (
                <div key={item} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-3 text-sm text-[var(--text-main)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {digitalBoardCards.map((card) => (
              <article key={card.title} className="premium-card border border-electric-300/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{card.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-electric-300">{card.meta}</p>
                  </div>
                  <span className="rounded-full border border-electric-300/25 bg-electric-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
                    Nachweis
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
                  {card.lines.map((line) => (
                    <div key={line} className="rounded-xl border border-[var(--line)] bg-slate-950/45 px-3 py-2 text-sm text-[var(--text-main)]">
                      {line}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={115}>
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Über KusiPrimeTec</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Persönliche Betreuung mit technischem und organisatorischem Blick.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              Robert Kusminov ist ausgebildeter Elektroniker für Energie- und Gebäudetechnik und verfügt über mehrjährige Berufserfahrung im technischen Facility Management. Heute verbindet er diese Erfahrung bei KusiPrimeTec mit persönlicher ObjektBetreuung, klaren Prozessen und digitaler Dokumentation.
            </p>
            <NavLink
              to="/ueber-kusiprimetec"
              className="btn-secondary-premium inline-flex min-h-[52px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
            >
              Mehr über KusiPrimeTec
            </NavLink>
          </div>

          <article className="premium-card border border-electric-300/20 p-4">
            <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-950/55">
                <img src="/Pb.png" alt="Robert Kusminov, Inhaber von KusiPrimeTec" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ihr Ansprechpartner</p>
                <p className="text-xl font-semibold text-white">{COMPANY_PROFILE.ownerName}</p>
                <p className="text-sm leading-relaxed text-[var(--text-soft)]">
                  Mehrjährige Praxis in Verkaufs-, Büro- und Bestandsobjekten sowie Erfahrung in Störungsbearbeitung, Dokumentation und technischen Abstimmungen.
                </p>
              </div>
            </div>
          </article>
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg text-center" minHeight={220} delayMs={130}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Nächster Schritt</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Sie suchen einen festen Ansprechpartner für technische Themen im Bestand?</h2>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          Starten Sie mit einer ObjektBetreuungs-Anfrage, lernen Sie den ObjektCheck kennen oder melden Sie ein einzelnes Thema über den bestehenden Ticket-Flow.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektbetreuung"
            className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektBetreuung anfragen
          </NavLink>
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektcheck"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektCheck anfragen
          </NavLink>
          <NavLink
            to="/einzelauftrag"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            Einzelauftrag melden
          </NavLink>
        </div>
        <p className="mt-4 text-xs text-[var(--text-soft)]">
          Einsatzradius: {BUSINESS_RULES.serviceArea.radiusKm} km ab {BUSINESS_RULES.serviceArea.centerCity}
        </p>
      </LazySection>
    </div>
  );
}
