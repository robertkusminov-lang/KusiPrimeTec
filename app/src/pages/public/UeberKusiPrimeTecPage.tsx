import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { COMPANY_PROFILE } from "@/config/businessRules";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

const stations = [
  "Ausgebildeter Elektroniker für Energie- und Gebäudetechnik",
  "Mehrjährige Erfahrung im technischen Facility Management",
  "Tätigkeit als Gebäudetechniker und im technischen Sachbearbeitungsumfeld",
  "Betreuung von Verkaufs-, Büro- und Wohnobjekten",
  "Verantwortung für technische Vorgänge, Störungsbearbeitung, Dokumentation und organisatorische Abstimmungen",
  "Zeitweise Verantwortung für fünf bis zehn Objekte",
] as const;

const todayFocus = [
  "Persönliche ObjektBetreuung statt anonymer Übergaben",
  "Klare Prozesse zwischen Meldung, Bearbeitung und Rapport",
  "Digitale Dokumentation für Kunden, Verwaltungen und Eigentümer",
  "Praktischer Blick auf technische Kleinthemen im laufenden Betrieb",
] as const;

export default function UeberKusiPrimeTecPage() {
  useSeo({
    title: "Über KusiPrimeTec und Robert Kusminov",
    description:
      "Mehr über Robert Kusminov, seinen Hintergrund als Elektroniker für Energie- und Gebäudetechnik und die Ausrichtung von KusiPrimeTec als persönlicher technischer Immobilienservice.",
    canonicalPath: "/ueber-kusiprimetec",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
              Über KusiPrimeTec
            </p>
            <h1 className="hero-display text-white">Persönliche Betreuung mit technischem Hintergrund und klaren Prozessen.</h1>
            <p className="hero-support text-electric-100">
              {COMPANY_PROFILE.ownerName} verbindet praktische Erfahrung im Gebäudebestand mit digital organisierter Dokumentation und strukturierter Abstimmung im Tagesgeschäft.
            </p>
          </div>

          <article className="premium-card border border-electric-300/20 p-4">
            <div className="grid gap-4 sm:grid-cols-[190px_1fr] sm:items-center">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-950/55">
                <img src="/Pb.png" alt="Robert Kusminov, Inhaber von KusiPrimeTec" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Inhaber</p>
                <p className="text-xl font-semibold text-white">{COMPANY_PROFILE.ownerName}</p>
                <p className="text-sm leading-relaxed text-[var(--text-soft)]">
                  Elektroniker für Energie- und Gebäudetechnik mit Erfahrung in technischen Vorgängen, Störungsbearbeitung, Dokumentation und organisatorischen Abstimmungen im Bestand.
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <LazySection className="premium-card page-card-lg" minHeight={260} delayMs={35}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Beruflicher Hintergrund</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Praxis im Bestand, nicht nur Theorie aus dem Büro.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {stations.map((station) => (
            <article key={station} className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              {station}
            </article>
          ))}
        </div>
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={220} delayMs={50}>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Heute bei KusiPrimeTec</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Praktische Arbeit mit digitalen Prozessen verbinden.</h2>
            <p className="text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
              KusiPrimeTec ist bewusst kein Großunternehmen und kein anonymer Vermittler. Im Mittelpunkt stehen persönliche Verantwortung, nachvollziehbare Rückmeldungen und ein klarer Ablauf von der Aufnahme bis zur Dokumentation.
            </p>
          </div>

          <div className="grid gap-3">
            {todayFocus.map((item) => (
              <article key={item} className="rounded-2xl border border-electric-300/20 bg-slate-950/40 px-4 py-4 text-sm text-[var(--text-main)]">
                {item}
              </article>
            ))}
          </div>
        </div>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={170} delayMs={65}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Nächster Schritt</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Wenn Sie einen festen Ansprechpartner für technische Themen im Bestand suchen, beginnt der Weg mit einer sauberen Anfrage.</h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
        </div>
      </LazySection>
    </div>
  );
}
