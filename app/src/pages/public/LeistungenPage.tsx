import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { KOORDINATION_RECHTSTEXT, LEISTUNGSUMFANG_HINWEIS } from "@/data/content";
import { SERVICE_CATEGORIES } from "@/data/publicWebsite";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function LeistungenPage() {
  useSeo({
    title: "Leistungen für technische Bestandsbetreuung | KusiPrimeTec",
    description:
      "Öffentliche Leistungsübersicht von KusiPrimeTec: ObjektBetreuung, ObjektCheck, Störungs- und Mängelaufnahme, Instandhaltung im Bestand, Dokumentation und Fachfirmenkoordination.",
    canonicalPath: "/leistungen",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Öffentliche Leistungsübersicht
          </p>
          <h1 className="hero-display text-white">Leistungen für Gewerbeobjekte und Bestandsimmobilien klar geordnet.</h1>
          <p className="hero-support text-electric-100">
            KusiPrimeTec ordnet technische Leistungen kundenverständlich: mit ObjektBetreuung als Kernangebot, ObjektCheck als Einstieg und klarer Abgrenzung zu fachpflichtigen Gewerken.
          </p>
        </div>
      </section>

      <LazySection className="grid gap-4 md:grid-cols-2" minHeight={360} delayMs={35}>
        {SERVICE_CATEGORIES.map((item) => (
          <article key={item.title} className="premium-card page-card">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistung</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{item.text}</p>
          </article>
        ))}
      </LazySection>

      <LazySection className="premium-card premium-card-strong page-card-lg" minHeight={220} delayMs={50}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungslogik</p>
        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Nicht jedes Thema ist sofort eine Reparatur – oft beginnt es mit Aufnahme, Priorisierung und Abstimmung.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          Interne Bearbeitungsschritte wie Materialbedarf, Rückfragen, Terminplanung oder Dokumentation bleiben Teil der bestehenden Ticketlogik. Öffentlich sichtbar werden nur die Leistungen, die für Kunden als Angebotsbild relevant sind.
        </p>
      </LazySection>

      <LazySection className="grid gap-4 lg:grid-cols-2" minHeight={240} delayMs={65}>
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistungsabgrenzung</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Klare Grenzen gehören zur Leistung dazu.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{LEISTUNGSUMFANG_HINWEIS}</p>
        </article>

        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Projektkoordination</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Koordination ist organisatorische Leistung – nicht Fachausführung.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)]">{KOORDINATION_RECHTSTEXT}</p>
        </article>
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={180} delayMs={80}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <NavLink
            to="/objektbetreuung"
            className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektBetreuung ansehen
          </NavLink>
          <NavLink
            to="/objektcheck"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            ObjektCheck ansehen
          </NavLink>
          <NavLink
            to="/einzelauftrag"
            className="btn-secondary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            Einzelauftrag anfragen
          </NavLink>
        </div>
      </LazySection>
    </div>
  );
}
