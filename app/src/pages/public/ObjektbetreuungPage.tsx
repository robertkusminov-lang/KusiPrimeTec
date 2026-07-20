import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { useSeo } from "@/hooks/useSeo";

const benefits = [
  "Fester technischer Ansprechpartner für das Objekt",
  "Planbare monatliche Kosten",
  "Weniger Einzelbeauftragungen",
  "Kleinreparaturen im zulässigen Rahmen",
  "Kurzfristige Unterstützung nach Verfügbarkeit",
  "Regelmäßige Rundgänge und Sichtkontrollen nach Bedarf",
  "Aufnahme und Dokumentation sichtbarer Mängel",
  "Flexible Nutzung des Stundenkontingents",
  "Nicht genutzte Stunden bis zu 2 Monate übertragbar",
  "Zusatzleistungen werden bei Bedarf vorab abgestimmt",
  "Unterstützung bei der Koordination externer Fachfirmen",
  "Bessere Planbarkeit von Instandhaltung und kleineren Maßnahmen",
];

const packages = [
  {
    name: "Objektbetreuung Start",
    price: "399 € / Monat",
    hours: "inkl. 8 Stunden Betreuungskontingent",
    audience: "Ideal für kleinere Gewerbeflächen, Märkte, Praxen, Büros oder Bestandsobjekte, bei denen regelmäßig kleinere technische Themen anfallen.",
    points: [
      "8 Stunden monatliches Betreuungskontingent",
      "1 geplanter Sammeltermin pro Monat",
      "Technische Rundgänge nach Bedarf",
      "Kleinreparaturen im zulässigen Rahmen",
      "Kurzfristige Unterstützung bei kleineren technischen Themen nach Verfügbarkeit",
      "Aufnahme sichtbarer Mängel",
      "Kleinere Reparaturen an Ausstattung und Mobiliar",
      "Austausch einfacher Gebäudekomponenten",
      "Kurze Fotodokumentation",
      "Rückmeldung an Ansprechpartner",
    ],
  },
  {
    name: "Objektbetreuung Plus",
    price: "599 € / Monat",
    hours: "inkl. 12 Stunden Betreuungskontingent",
    audience: "Empfohlen für Märkte, Gewerbeobjekte, Unternehmen, Praxen, Läden und Standorte mit regelmäßigem technischem Betreuungsbedarf.",
    featured: true,
    points: [
      "12 Stunden monatliches Betreuungskontingent",
      "Bis zu 2 geplante Betreuungstermine pro Monat",
      "Technische Rundgänge",
      "Störungsaufnahme",
      "Kleinreparaturen im zulässigen Rahmen",
      "Kurzfristige Unterstützung nach Verfügbarkeit",
      "Aufnahme und Dokumentation sichtbarer Mängel",
      "Kleinere Instandhaltungsarbeiten im Bestand",
      "Reparaturen an Ausstattung, Mobiliar und einfachen Gebäudekomponenten",
      "Fotodokumentation nach Bedarf",
      "Priorisierung offener Punkte",
      "Koordination externer Fachfirmen nach Absprache",
      "Bevorzugte Terminplanung gegenüber Einzelaufträgen",
    ],
  },
  {
    name: "Objektbetreuung Premium",
    price: "899 € / Monat",
    hours: "inkl. 16 Stunden Betreuungskontingent",
    audience: "Für größere Gewerbeobjekte, Märkte mit höherem technischem Bedarf oder Kunden, die eine stärkere laufende Betreuung wünschen.",
    points: [
      "16 Stunden monatliches Betreuungskontingent",
      "Bis zu 3 geplante Betreuungstermine pro Monat",
      "Regelmäßige technische Objektkontrollen",
      "Laufende Mängel- und Maßnahmenliste",
      "Störungsaufnahme und technische Einschätzung",
      "Kleinreparaturen und Instandhaltung im Bestand",
      "Kurzfristige Unterstützung nach Verfügbarkeit",
      "Austausch einfacher Gebäudekomponenten",
      "Reparaturen an Ausstattung und Mobiliar",
      "Fotodokumentation",
      "Monatlicher Kurzbericht nach Bedarf",
      "Koordination externer Fachfirmen nach Absprache",
      "Bevorzugte Einsatzplanung",
      "Direkter technischer Ansprechpartner",
    ],
  },
  {
    name: "Objektbetreuung Individuell",
    price: "individuell kalkuliert",
    hours: "Leistungsumfang nach Objekt, Intervall und Bedarf abgestimmt",
    audience: "Für Kunden mit mehreren Standorten, besonderen Betriebszeiten oder erweitertem Koordinations-, Dokumentations- und Betreuungsbedarf.",
    points: [
      "Individuell abgestimmtes Betreuungskonzept",
      "Flexible Stundenkontingente oder feste Betreuungstermine",
      "Betreuung mehrerer Standorte möglich",
      "Erweiterte Maßnahmenlisten und Priorisierung",
      "Abgestimmte Rückmelde- und Dokumentationswege",
      "Eigenes Angebot nach Erstgespräch und Objektbewertung",
    ],
  },
];

const flexibleRules = [
  "Nicht genutzte Stunden können bis zu 2 Monate übertragen werden.",
  "Übertragene Stunden müssen innerhalb dieser 2 Monate genutzt werden.",
  "Danach verfallen nicht genutzte Stunden.",
  "Eine Auszahlung nicht genutzter Stunden ist ausgeschlossen.",
  "Die Übertragung gilt nur bei laufender Objektbetreuung.",
  "Material, Ersatzteile und Fremdleistungen werden separat berechnet.",
];

const contractRules = [
  "3 Monate Pilotphase",
  "danach automatische Mindestvertragslaufzeit von 6 Monaten, sofern nicht spätestens 14 Tage vor Ablauf der Pilotphase schriftlich beendet wird",
  "nach Ablauf der Mindestlaufzeit automatische Verlängerung auf unbestimmte Zeit",
  "Kündigung danach mit 4 Wochen Frist zum Monatsende",
];

function PackageCard({ item }: { item: (typeof packages)[number] }) {
  return (
    <article className={`premium-card relative flex h-full flex-col p-5 ${item.featured ? "border-electric-300/55 bg-electric-400/10" : "border-[var(--line)]"}`}>
      {item.featured ? (
        <span className="absolute right-4 top-4 rounded-full border border-electric-200/45 bg-electric-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
          Empfohlen
        </span>
      ) : null}
      <p className="pr-28 text-xs uppercase tracking-[0.12em] text-electric-300">{item.name}</p>
      <p className="mt-2 text-3xl font-extrabold text-white">{item.price}</p>
      <p className="mt-1 text-sm font-semibold text-electric-100">{item.hours}</p>
      <p className="mt-4 min-h-[96px] text-sm leading-relaxed text-[var(--text-soft)]">{item.audience}</p>
      <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
        {item.points.map((point) => (
          <li key={point} className="flex gap-2"><span className="mt-0.5 text-electric-300">✓</span><span>{point}</span></li>
        ))}
      </ul>
    </article>
  );
}

export default function ObjektbetreuungPage() {
  useSeo({
    title: "Objektbetreuung & technischer Immobilienservice | KusiPrimeTec Schorndorf",
    description:
      "KusiPrimeTec bietet technische Objektbetreuung für Gewerbeobjekte und Bestandsimmobilien im Raum Schorndorf: Kleinreparaturen im zulässigen Rahmen, Rundgänge, Mängeldokumentation und Instandhaltung im Bestand.",
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            KusiPrimeTec Objektbetreuung
          </p>
          <h1 className="hero-display text-white">KusiPrimeTec Objektbetreuung</h1>
          <p className="hero-support text-electric-100">
            Fester technischer Ansprechpartner für Gewerbeobjekte und Bestandsimmobilien
          </p>
          <p className="public-page-lead max-w-4xl">
            Mit der KusiPrimeTec Objektbetreuung erhalten Unternehmen, Märkte, Praxen, Büros und Eigentümer einen festen technischen Ansprechpartner für wiederkehrende kleinere Themen im laufenden Betrieb. Kleinreparaturen, Rundgänge, Mängelaufnahmen, kurzfristige Unterstützung nach Verfügbarkeit und kleinere Instandhaltungsarbeiten können gesammelt, geplant und zuverlässig abgearbeitet werden.
          </p>
          <div className="flex flex-wrap gap-3">
            <NavLink to="/objektbetreuung-anfrage" className="btn-primary-premium rounded-full px-6 py-3 text-sm font-semibold">Objektbetreuung anfragen</NavLink>
            <a href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20interessiere%20mich%20für%20die%20Objektbetreuung." target="_blank" rel="noopener noreferrer" className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold">WhatsApp-Kontakt</a>
          </div>
        </div>
      </section>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={40}>
        <h2 className="text-2xl font-bold text-white md:text-3xl">Ihre Vorteile</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((item) => <div key={item} className="rounded-xl border border-electric-300/20 bg-slate-950/35 px-3 py-2 text-sm text-[var(--text-main)]">✓ {item}</div>)}
        </div>
      </LazySection>

      <LazySection className="space-y-5" minHeight={420} delayMs={60}>
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Pakete</p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Objektbetreuung-Pakete</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Monatliche technische Betreuung für Gewerbeobjekte und Bestandsimmobilien mit klaren Stundenkontingenten oder individuell abgestimmtem Leistungsumfang.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {packages.map((item) => <PackageCard key={item.name} item={item} />)}
        </div>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={300} delayMs={80}>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Flexible Stundenregelung</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">{flexibleRules.map((rule) => <li key={rule}>• {rule}</li>)}</ul>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Zusatzleistungen nach Abstimmung</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Zusätzliche Arbeiten außerhalb des laufenden Betreuungskontingents werden ausschließlich nach vorheriger Abstimmung eingeplant. Umfangreichere Maßnahmen, Projektarbeiten oder größere Reparaturen können separat kalkuliert und als eigenes Angebot dargestellt werden.
          </p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Akute Themen und kurzfristige Unterstützung</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">
            Bei akuten kleineren technischen Themen kann KusiPrimeTec während einer aktiven Objektbetreuung kurzfristig unterstützen, sofern es terminlich möglich ist. Ist noch Betreuungskontingent verfügbar, wird der Einsatz auf das vorhandene Stundenkontingent angerechnet. Ist das Kontingent ausgeschöpft, werden weitere Schritte vorab abgestimmt. Kurzfristige Einsätze erfolgen nach Verfügbarkeit. Ein Anspruch auf sofortige Verfügbarkeit oder ein garantierter Notdienst besteht nicht, sofern dies nicht ausdrücklich separat vereinbart wurde.
          </p>
        </article>
        <article className="premium-card page-card">
          <h2 className="text-xl font-bold text-white">Start mit Pilotphase</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">{contractRules.map((rule) => <li key={rule}>• {rule}</li>)}</ul>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={200} delayMs={110}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsabgrenzung</p>
        <h2 className="mt-2 text-xl font-bold text-white">Hinweis zur Leistungsabgrenzung</h2>
        <p className="mt-3 max-w-5xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          KusiPrimeTec arbeitet als technischer Immobilienservice im Bereich Bestandsbetreuung, Wartung, Instandhaltung, Störungsaufnahme, Mängeldokumentation, Kleinreparaturen im zulässigen Rahmen und Projektkoordination. Nicht angeboten werden meisterpflichtige Arbeiten, Abnahmen, eigenverantwortliche Planung oder Errichtung elektrotechnischer Anlagen, Arbeiten an Zähleranlagen sowie Prüfungen oder Abnahmen, die gesetzlich oder handwerksrechtlich einem qualifizierten Fachbetrieb vorbehalten sind. Soweit entsprechende Facharbeiten erforderlich sind, werden qualifizierte Fachfirmen hinzugezogen oder koordiniert.
        </p>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg text-center" minHeight={170} delayMs={130}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Nächster Schritt</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Objektbetreuung anfragen</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-soft)]">Beschreiben Sie kurz Ihr Objekt und den gewünschten Leistungsumfang. Wir melden uns mit einer klaren Ersteinschätzung und passenden nächsten Schritten.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <NavLink to="/objektbetreuung-anfrage" className="btn-primary-premium rounded-full px-6 py-3 text-sm font-semibold">Pilotphase starten</NavLink>
          <NavLink to="/objektbetreuung-anfrage" className="btn-secondary-premium rounded-full px-6 py-3 text-sm font-semibold">Angebot anfordern</NavLink>
        </div>
      </LazySection>
    </div>
  );
}
