import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { PackageGrid, ServicePricingCards } from "@/components/public/PricingSections";
import { BUSINESS_RULES } from "@/config/businessRules";
import { PUBLIC_PRICING, PUBLIC_SERVICES } from "@/config/publicServices";
import {
  KOORDINATION_RECHTSTEXT,
  LEISTUNGEN,
  LEISTUNGSUMFANG_ERLAUBT,
  LEISTUNGSUMFANG_HINWEIS,
  LEISTUNGSUMFANG_NICHT,
  PUBLIC_PATHS,
} from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { eur } from "@/lib/format";
import { trackGoogleEvent } from "@/lib/googleTag";

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

const qualificationCards = [
  {
    marker: "G",
    title: "Gesellenabschluss",
    text: "Abgeschlossene Berufsausbildung als Elektroniker für Energie- und Gebäudetechnik.",
  },
  {
    marker: "11",
    title: "11 ETZ-Lehrgänge",
    text: "Überbetriebliche Fachausbildung in Installation und Prüfung, Mess- und Steuerungstechnik, Netzwerken, Gebäudekommunikation und Gebäudesystemtechnik.",
  },
  {
    marker: "P",
    title: "Praktische Erfahrung",
    text: "Mehrjährige Erfahrung im technischen Gebäudeservice, in der Instandhaltung, Störungsaufnahme und strukturierten Objektbetreuung.",
  },
];

export default function HomePage() {
  useSeo({
    title: "Technischer Immobilienservice & Objektbetreuung | KusiPrimeTec Schorndorf",
    description:
      "KusiPrimeTec bietet technischen Störungsservice, Objekt- und Hausmeisterservice, monatliche Objektbetreuung und Projektkoordination im Raum Schorndorf.",
    canonicalPath: "/",
  });

  return (
    <div className="page-enter page-stack-large">
      <div className="fixed bottom-5 right-5 z-50 hidden w-[280px] flex-col gap-2 2xl:flex">
        <a
          href="tel:+491776364393"
          onClick={() => trackGoogleEvent("contact_phone_click", { placement: "home_floating" })}
          className="btn-primary-premium w-full rounded-full px-4 py-3 text-center text-sm font-semibold shadow-[0_16px_40px_rgba(3,14,32,0.5)]"
        >
          Direkt anrufen
        </a>
        <a
          href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20brauche%20Unterstützung."
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackGoogleEvent("whatsapp_click", { placement: "home_floating" })}
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
                {PUBLIC_SERVICES[0].name} {eur(PUBLIC_SERVICES[0].priceEur)} / Stunde · {PUBLIC_SERVICES[1].name} {eur(PUBLIC_SERVICES[1].priceEur)} / Stunde
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
              <NavLink to="/objektcheck" className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold">
                Kostenlosen ObjektCheck starten
              </NavLink>
              <a
                href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20habe%20eine%20Frage."
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackGoogleEvent("whatsapp_click", { placement: "home_hero" })}
                className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold"
              >
                WhatsApp-Kontakt
              </a>
            </div>

            <div className="grid gap-2 sm:max-w-2xl sm:grid-cols-2">
              <a
                href="mailto:info@kusiprimetec.de?subject=Anfrage%20KusiPrimeTec"
                onClick={() => trackGoogleEvent("contact_email_click", { placement: "home_hero" })}
                className="inline-flex items-center justify-center rounded-full border border-electric-300/35 bg-slate-900/45 px-4 py-2 text-sm text-electric-200 transition hover:border-electric-200/60 hover:text-white"
              >
                E-Mail: info@kusiprimetec.de
              </a>
              <a
                href="tel:+491776364393"
                onClick={() => trackGoogleEvent("contact_phone_click", { placement: "home_hero" })}
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
                  <img src="/Pb.webp" alt="Robert Kusminov - KusiPrimeTec" width="768" height="512" className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                {entry.title}
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

      <LazySection className="space-y-5" minHeight={420} delayMs={85}>
        <header className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Zwei klare Einzelleistungen</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Objektunterstützung oder technische Störungsaufnahme</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Der Objekt- & Hausmeisterservice unterstützt laufende Objektaufgaben. Der technische Störungsservice
            konzentriert sich auf Erstaufnahme, Fehlereingrenzung und dokumentierte nächste Schritte.
          </p>
        </header>
        <ServicePricingCards compact />
        <p className="text-xs leading-relaxed text-[var(--text-soft)]">{PUBLIC_PRICING.taxNotice}</p>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={620} delayMs={95}>
        <header className="max-w-4xl space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Objektbetreuung als Hauptangebot</p>
          <h2 className="text-2xl font-bold text-white md:text-4xl">Planbare Objektbetreuung statt unstrukturierter Einzelanfragen</h2>
          <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            Die KusiPrimeTec Objektbetreuung richtet sich an Unternehmen, Märkte, Praxen, Büros, Eigentümer und
            Verwaltungen, die wiederkehrende technische Themen im Bestand strukturiert lösen wollen. Vier klar
            abgestufte Pakete verbinden planbare Kontingente, Vor-Ort-Termine und digitale Dokumentation.
          </p>
        </header>

        <section className="mt-6">
          <PackageGrid compact />
        </section>
        <p className="mt-4 text-xs leading-relaxed text-[var(--text-soft)]">{PUBLIC_PRICING.taxNotice}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <NavLink to="/objektbetreuung-anfrage?auswahl=pro" className="btn-primary-premium inline-flex min-h-12 items-center rounded-full px-5 py-3 text-sm font-semibold">Pro unverbindlich anfragen</NavLink>
          <NavLink to="/preise" className="btn-secondary-premium rounded-full px-5 py-3 text-sm font-semibold">Preise ansehen</NavLink>
          <a href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20interessiere%20mich%20für%20die%20Objektbetreuung." target="_blank" rel="noopener noreferrer" onClick={() => trackGoogleEvent("whatsapp_click", { placement: "home_packages" })} className="btn-secondary-premium rounded-full px-5 py-3 text-sm font-semibold">WhatsApp-Kontakt</a>
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

      <section
        className="premium-card premium-card-strong page-card-lg"
        aria-labelledby="qualifications-heading"
      >
        <header className="max-w-4xl space-y-3">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Fachkompetenz</p>
          <h2 id="qualifications-heading" className="text-2xl font-bold text-white md:text-3xl">
            Fachlich qualifiziert. Praktisch erfahren.
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            KusiPrimeTec verbindet technische Objektbetreuung mit fundierter Fachkompetenz. Inhaber Robert Kusminov
            verfügt über eine abgeschlossene Berufsausbildung als Elektroniker für Energie- und Gebäudetechnik sowie
            über elf erfolgreich absolvierte ETZ-Lehrgänge im Rahmen der überbetrieblichen Ausbildung.
          </p>
        </header>

        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
          {qualificationCards.map((card) => (
            <article key={card.title} className="premium-card flex h-full flex-col p-5">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-electric-300/45 bg-electric-400/10 text-sm font-bold text-electric-300"
                aria-hidden="true"
              >
                {card.marker}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{card.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-soft)]">
            Qualifikationsnachweise stellen wir Geschäftskunden auf Anfrage zur Verfügung.
          </p>
          <NavLink
            to="/buchen"
            className="btn-primary-premium inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold sm:w-auto"
          >
            Projekt anfragen
          </NavLink>
        </div>
      </section>

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
