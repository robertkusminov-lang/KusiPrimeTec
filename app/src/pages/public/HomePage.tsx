import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { BUSINESS_RULES } from "@/config/businessRules";
import {
  KOORDINATION_RECHTSTEXT,
  LEISTUNGEN,
  LEISTUNGSUMFANG_ERLAUBT,
  LEISTUNGSUMFANG_HINWEIS,
  LEISTUNGSUMFANG_NICHT,
  PUBLIC_PATHS,
} from "@/data/content";
import { useSeo } from "@/hooks/useSeo";

const trustBar = [
  `Fokusregion ${BUSINESS_RULES.serviceArea.text}`,
  "Technische Objektbetreuung für Gewerbe und Bestand",
  "Dokumentierte Abläufe und klare Rückmeldungen",
  "Koordination externer Fachfirmen bei Bedarf",
];

const heroBadges = ["Schnelle Einsatzzeiten", "Klare Preise", "Direkter Ansprechpartner"];

const serviceHighlights = [
  "Störungen im Bestand aufnehmen und strukturiert lösen",
  "Kleinreparaturen im zulässigen Rahmen",
  "Wartung und Instandhaltung im laufenden Betrieb",
  "Technische Objektbetreuung für Gewerbeobjekte",
];

const processSteps = [
  { nr: "01", title: "Anfrage erfassen", text: "Objekt, Standort und Thema strukturiert aufnehmen." },
  { nr: "02", title: "Einordnung", text: "Technische Sichtung, Priorisierung und Terminabstimmung." },
  { nr: "03", title: "Umsetzung", text: "Arbeiten im zulässigen Rahmen oder koordinierte Fachfirmensteuerung." },
  { nr: "04", title: "Nachweis", text: "Rapport, Fotodokumentation und klare Rückmeldung für die Objektakte." },
];

const whyKusiPoints = [
  "Praxis im Gebäudebestand und strukturierte Vorgehensweise",
  "Persönlicher Ansprechpartner statt wechselnder Hotline",
  "Digitale Ticketführung mit nachvollziehbaren Nachweisen",
  "Koordination qualifizierter Fachfirmen bei Bedarf",
];

const packageRules = [
  "Nicht genutzte Stunden können bis zu 2 Monate übertragen werden.",
  "Danach verfallen nicht genutzte Stunden.",
  "Eine Auszahlung nicht genutzter Stunden ist ausgeschlossen.",
  "Material, Ersatzteile und Fremdleistungen werden separat berechnet.",
  "Zusatzarbeiten während aktiver Objektbetreuung werden vorab abgestimmt.",
  "Kurzfristige Einsätze erfolgen nach Verfügbarkeit. Ein garantierter Notdienst ist nicht enthalten.",
];

const packages = [
  {
    name: "Objektbetreuung Start",
    kicker: "ab 399 € / Monat",
    price: "399 € / Monat",
    hours: "inkl. 8 Stunden Betreuungskontingent",
    text: "Für kleinere Gewerbeflächen, Praxen, Büros und Bestandsobjekte mit planbarem technischem Betreuungsbedarf.",
    points: [
      "8 Stunden pro Monat",
      "Kleinreparaturen im zulässigen Rahmen",
      "Mängelaufnahme und Fotodokumentation",
      "Rundgänge und Sichtkontrollen nach Bedarf",
      "Fester technischer Ansprechpartner",
    ],
  },
  {
    name: "Objektbetreuung Plus",
    kicker: "ab 599 € / Monat",
    price: "599 € / Monat",
    hours: "inkl. 12 Stunden Betreuungskontingent",
    featured: true,
    text: "Empfohlen für Märkte, Gewerbeobjekte und Standorte mit wiederkehrenden technischen Themen im laufenden Betrieb.",
    points: [
      "12 Stunden pro Monat",
      "Störungsaufnahme und Priorisierung",
      "Kleinreparaturen und Instandhaltung im Bestand",
      "Koordination externer Fachfirmen nach Absprache",
      "Bevorzugte Terminplanung gegenüber Einzelanfragen",
    ],
  },
  {
    name: "Objektbetreuung Premium",
    kicker: "ab 899 € / Monat",
    price: "899 € / Monat",
    hours: "inkl. 16 Stunden Betreuungskontingent",
    text: "Für größere Bestandsobjekte oder Kunden, die eine engere laufende technische Betreuung wünschen.",
    points: [
      "16 Stunden pro Monat",
      "Regelmäßige Objektkontrollen",
      "Laufende Mängel- und Maßnahmenliste",
      "Monatliche Rückmeldung nach Bedarf",
      "Direkter Ansprechpartner und koordinierte Folgeschritte",
    ],
  },
  {
    name: "Objektbetreuung Individuell",
    kicker: "individuell abgestimmt",
    price: "individuell kalkuliert",
    hours: "Leistungsumfang nach Objekt, Intervall und Bedarf abgestimmt",
    text: "Für Kunden mit mehreren Standorten, besonderen Abläufen oder erweitertem Koordinations- und Dokumentationsbedarf.",
    points: [
      "Individuelles Betreuungskonzept",
      "Flexible Kontingente oder feste Betreuungstage",
      "Mehrere Objekte oder Ansprechpartner möglich",
      "Abgestimmte Dokumentation und Priorisierung",
      "Eigenes Angebot nach Erstgespräch",
    ],
  },
];

export default function HomePage() {
  useSeo({
    title: "Technischer Immobilienservice & Objektbetreuung | KusiPrimeTec Schorndorf",
    description:
      "KusiPrimeTec bietet technische Objektbetreuung, Kleinreparaturen im zulässigen Rahmen, Instandhaltung, Störungsaufnahme und Projektkoordination für Bestandsimmobilien und Gewerbeobjekte im Raum Schorndorf.",
  });

  return (
    <div className="page-enter page-stack-large">
      <div className="fixed bottom-5 right-5 z-50 hidden w-[280px] flex-col gap-2 2xl:flex">
        <a
          href="tel:+491776364393"
          className="btn-primary-premium w-full rounded-full px-4 py-3 text-center text-sm font-semibold shadow-[0_16px_40px_rgba(3,14,32,0.5)]"
        >
          Direkt anrufen
        </a>
        <a
          href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20brauche%20Unterstützung."
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary-premium w-full rounded-full px-4 py-3 text-center text-sm font-semibold"
        >
          WhatsApp Kontakt
        </a>
      </div>

      <section className="hero-bg-shift premium-card premium-card-strong page-card-hero relative overflow-hidden">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="min-w-0 space-y-5">
            <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/64 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
              Technischer Immobilienservice für Bestandsobjekte
            </p>
            <h1 className="hero-display max-w-4xl text-white">
              Technischer Immobilienservice für Bestandsobjekte
            </h1>
            <p className="hero-support text-electric-100">
              Objektbetreuung, Kleinreparaturen, Instandhaltung und handwerklich-technischer Allround-Service im zulässigen Rahmen für Gewerbe, Eigentümer und Verwaltungen im Raum Schorndorf.
            </p>
            <p className="public-page-lead max-w-4xl">
              KusiPrimeTec unterstützt Unternehmen, Märkte, Praxen, Büros, Eigentümer und Hausverwaltungen bei technischen und handwerklichen Themen im Gebäudebestand. Der Fokus liegt auf planbarer Objektbetreuung, Störungsaufnahme, Kleinreparaturen im zulässigen Rahmen, Mängeldokumentation und der Koordination externer Fachfirmen.
            </p>

            <div className="flex flex-wrap gap-2">
              {heroBadges.map((badge) => (
                <span key={badge} className="inline-flex items-center rounded-full border border-electric-300/35 bg-slate-900/55 px-3 py-1 text-xs text-electric-100">
                  {badge}
                </span>
              ))}
            </div>

            <div className="space-y-1 text-xs text-[var(--text-soft)] md:text-sm">
              <p>
                {BUSINESS_RULES.pricing.hourlyRateEur} € / Stunde · {BUSINESS_RULES.pricing.serviceCallFlatEur} € Einsatzpauschale · Zuschläge klar geregelt
              </p>
              <p>{BUSINESS_RULES.response.text}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <NavLink to="/objektbetreuung-anfrage" className="btn-primary-premium cta-pulse rounded-full px-6 py-3 text-sm font-semibold">
                Objektbetreuung anfragen
              </NavLink>
              <NavLink to="/einzelauftrag" className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold">
                Einzelauftrag anfragen
              </NavLink>
              <a
                href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20habe%20eine%20Frage."
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold"
              >
                WhatsApp-Kontakt
              </a>
            </div>

            <div className="grid gap-2 sm:max-w-2xl sm:grid-cols-2">
              <a
                href="mailto:info@kusiprimetec.de?subject=Anfrage%20KusiPrimeTec"
                className="inline-flex items-center justify-center rounded-full border border-electric-300/35 bg-slate-900/45 px-4 py-2 text-sm text-electric-200 transition hover:border-electric-200/60 hover:text-white"
              >
                E-Mail: info@kusiprimetec.de
              </a>
              <a
                href="tel:+491776364393"
                className="inline-flex items-center justify-center rounded-full border border-electric-300/35 bg-slate-900/45 px-4 py-2 text-sm text-electric-200 transition hover:border-electric-200/60 hover:text-white"
              >
                Telefon: 0177 6364393
              </a>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <article className="premium-card border border-electric-300/25 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsfokus</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Gebäudetechnik im Fokus. Bestandsservice als Kern. Lösungen, die funktionieren.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
                Technische Probleme im Gebäude werden analysiert, behoben und strukturiert umgesetzt - mit Blick auf das gesamte Objekt und eine dauerhaft saubere Betreuung.
              </p>
            </article>

            <article className="premium-card border border-electric-300/20 p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsabgrenzung</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
                Keine Neuinstallationen, keine Zähleranlagen, keine Abnahmen, keine eigenverantwortliche Errichtung elektrotechnischer Anlagen und keine meisterpflichtigen Arbeiten in eigener Verantwortung.
              </p>
            </article>

            <article className="premium-card border border-electric-300/20 p-4">
              <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-900/55">
                  <img src="/Pb.png" alt="Robert Kusminov - KusiPrimeTec" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ihr Ansprechpartner</p>
                  <p className="text-lg font-semibold text-white">Robert Kusminov</p>
                  <p className="text-sm text-[var(--text-soft)]">Persönliche Betreuung, klare Kommunikation und verbindliche Rückmeldungen vor Ort.</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <LazySection className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" minHeight={150} delayMs={30}>
        {trustBar.map((item, idx) => (
          <article key={item} className="premium-card flex items-center gap-3 p-4">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-electric-300/45 bg-electric-400/10 text-[10px] font-semibold text-electric-300">{idx + 1}</span>
            <p className="text-xs leading-relaxed text-[var(--text-main)]">{item}</p>
          </article>
        ))}
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={240} delayMs={35}>
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Drei Wege</p>
          <h2 className="text-2xl font-bold text-white md:text-3xl">Einzelauftrag, ObjektBetreuung und Kundenlogin klar getrennt</h2>
        </header>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {PUBLIC_PATHS.map((entry) => (
            <article key={entry.href} className="premium-card flex h-full flex-col p-4">
              <h3 className="text-lg font-semibold text-white">{entry.title}</h3>
              <p className="mt-2 flex-1 text-sm text-[var(--text-soft)]">{entry.text}</p>
              <NavLink to={entry.href} className="btn-secondary-premium mt-4 inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold">
                Öffnen
              </NavLink>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={220} delayMs={45}>
        <header className="mb-4 space-y-1">
          <h2 className="text-xl font-semibold text-white md:text-2xl">Unsere Leistungen</h2>
          <p className="text-sm text-[var(--text-soft)]">Direkte Unterstützung im Bestand mit klar abgegrenztem Leistungsrahmen.</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {serviceHighlights.map((item) => (
            <article key={item} className="premium-card border border-electric-300/25 p-4 text-sm text-[var(--text-main)]">
              {item}
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={60}>
        <header className="mb-4 space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsspektrum</p>
          <h2 className="text-2xl font-bold text-white md:text-3xl">Was KusiPrimeTec im Bestand übernimmt</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {LEISTUNGEN.map((item) => (
            <article key={item.titel} className="premium-card p-5">
              <h3 className="text-lg font-semibold text-white">{item.titel}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{item.text}</p>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card page-card" minHeight={220} delayMs={75}>
        <h2 className="text-xl font-semibold text-white">Hinweis zur Leistungsabgrenzung</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{LEISTUNGSUMFANG_HINWEIS}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-300/30 bg-emerald-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Was wir anbieten</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_ERLAUBT.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-rose-300/30 bg-rose-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">Nicht direkt durch uns</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_NICHT.map((item) => (
                <li key={item}>✗ {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={620} delayMs={95}>
        <header className="max-w-4xl space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Objektbetreuung als Hauptangebot</p>
          <h2 className="text-2xl font-bold text-white md:text-4xl">Planbare Objektbetreuung statt unstrukturierter Einzelanfragen</h2>
          <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Die KusiPrimeTec Objektbetreuung richtet sich an Unternehmen, Märkte, Praxen, Büros, Eigentümer und Verwaltungen, die wiederkehrende technische Themen im Bestand strukturiert lösen wollen. Neben den festen Paketen ist auch ein individuell kalkuliertes Betreuungskonzept möglich.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {packages.map((pkg) => (
            <article key={pkg.name} className={`premium-card flex h-full flex-col p-5 ${pkg.featured ? "border-electric-300/60 bg-electric-400/10 shadow-[0_20px_60px_rgba(56,189,248,0.12)]" : "border-[var(--line)]"}`}>
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{pkg.kicker}</p>
              <h3 className="mt-2 text-xl font-bold text-white">{pkg.name}</h3>
              {pkg.featured ? <p className="mt-2 inline-flex w-fit rounded-full border border-electric-200/45 bg-electric-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">Empfohlen</p> : null}
              <p className="mt-3 text-3xl font-extrabold text-white">{pkg.price}</p>
              <p className="mt-1 text-sm font-semibold text-electric-100">{pkg.hours}</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">{pkg.text}</p>
              <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
                {pkg.points.map((point) => (
                  <li key={point} className="flex gap-2"><span className="text-electric-300">✓</span><span>{point}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="premium-card p-5">
            <h3 className="text-lg font-semibold text-white">Wichtige Regeln</h3>
            <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">
              {packageRules.map((rule) => (
                <li key={rule}>• {rule}</li>
              ))}
            </ul>
          </article>
          <article className="premium-card p-5">
            <h3 className="text-lg font-semibold text-white">Ihre Vorteile</h3>
            <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">
              <li>• Fester technischer Ansprechpartner</li>
              <li>• Planbare monatliche Kosten</li>
              <li>• Kleinreparaturen im zulässigen Rahmen</li>
              <li>• Rundgänge und Sichtkontrollen nach Bedarf</li>
              <li>• Koordination externer Fachfirmen bei Bedarf</li>
            </ul>
          </article>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <NavLink to="/objektbetreuung-anfrage" className="btn-primary-premium rounded-full px-5 py-3 text-sm font-semibold">Objektbetreuung anfragen</NavLink>
          <NavLink to="/preise" className="btn-secondary-premium rounded-full px-5 py-3 text-sm font-semibold">Preise ansehen</NavLink>
          <a href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20interessiere%20mich%20für%20die%20Objektbetreuung." target="_blank" rel="noopener noreferrer" className="btn-secondary-premium rounded-full px-5 py-3 text-sm font-semibold">WhatsApp-Kontakt</a>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={115}>
        <header className="mb-5 space-y-1">
          <h2 className="text-2xl font-bold text-white md:text-3xl">So arbeiten wir</h2>
          <p className="text-sm text-[var(--text-soft)]">Klare Abläufe schaffen Transparenz und Planungssicherheit.</p>
        </header>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <article key={step.nr} className="premium-card group p-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-electric-300">{step.nr}</p>
              <h3 className="mt-1 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">{step.text}</p>
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={240} delayMs={130}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Warum KusiPrimeTec</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Vertrauen entsteht durch Klarheit, Dokumentation und persönliche Betreuung.</h2>
            <ul className="grid gap-3">
              {whyKusiPoints.map((point) => (
                <li key={point} className="premium-card p-4 text-sm text-[var(--text-main)]">✓ {point}</li>
              ))}
            </ul>
          </div>
          <div className="premium-card p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Projektkoordination</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Wenn Facharbeiten erforderlich sind, bleibt die Steuerung trotzdem klar.</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{KOORDINATION_RECHTSTEXT}</p>
          </div>
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong relative overflow-hidden p-6 text-center md:p-8" minHeight={190} delayMs={145}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(56,189,248,.16),transparent_72%)]" />
        <div className="relative space-y-3">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Struktur beginnt mit einer klaren Anfrage.</h2>
          <p className="text-sm text-[var(--text-soft)]">Beschreiben Sie Ihr Objekt oder Ihr technisches Thema. Wir melden uns mit einer sauberen Ersteinschätzung.</p>
          <div className="pt-1">
            <NavLink to="/buchen" className="btn-primary-premium cta-pulse rounded-full px-6 py-3 text-sm font-semibold">
              Jetzt Anfrage starten
            </NavLink>
          </div>
          <p className="text-xs text-[var(--text-soft)]">Dauer: ca. 60 Sekunden</p>
        </div>
      </LazySection>
    </div>
  );
}
