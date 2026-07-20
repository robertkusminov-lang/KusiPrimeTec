import { NavLink } from "react-router-dom";
import { LazySection } from "@/components/ui/LazySection";
import { REFERENCE_CASES } from "@/data/publicWebsite";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function ReferenzenPage() {
  useSeo({
    title: "Anonymisierte Referenzen und Arbeitsweise | KusiPrimeTec",
    description:
      "Drei anonymisierte Fallbeispiele zeigen, wie KusiPrimeTec technische Kleinthemen im Bestand aufnimmt, dokumentiert und in nachvollziehbare nächste Schritte überführt.",
    canonicalPath: "/referenzen",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Anonymisierte Referenzen
          </p>
          <h1 className="hero-display text-white">Arbeitsweise statt Kundendaten in den Mittelpunkt stellen.</h1>
          <p className="hero-support text-electric-100">
            Die folgenden Fallbeispiele zeigen typische Vorgehensweisen von KusiPrimeTec – anonymisiert, ohne sensible Objektdetails, Ansprechpartner oder interne Dokumente.
          </p>
        </div>
      </section>

      <LazySection className="grid gap-4" minHeight={420} delayMs={35}>
        {REFERENCE_CASES.map((item, index) => (
          <article key={item.title} className="premium-card page-card-lg">
            <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Fall {String(index + 1).padStart(2, "0")}</p>
                <h2 className="text-2xl font-bold text-white">{item.title}</h2>
                <p className="rounded-full border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-sm text-[var(--text-main)]">
                  {item.context}
                </p>
                <p className="text-sm leading-relaxed text-[var(--text-soft)]">{item.challenge}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-[var(--line)] bg-slate-950/35 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Leistung</p>
                  <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">
                    {item.services.map((entry) => (
                      <li key={entry}>• {entry}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl border border-electric-300/20 bg-electric-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ergebnis</p>
                  <ul className="mt-3 grid gap-2 text-sm text-[var(--text-main)]">
                    {item.outcome.map((entry) => (
                      <li key={entry}>• {entry}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </div>
          </article>
        ))}
      </LazySection>

      <LazySection className="premium-card page-card-lg" minHeight={180} delayMs={50}>
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Hinweis</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Keine sensiblen Objekt- oder Kundendetails.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
          KusiPrimeTec veröffentlicht bewusst keine Ticketnummern, Unterschriften, Ansprechpartner, internen Links, vollständigen Rapporte oder technischen Detailansichten aus realen Kundenobjekten. Sichtbar wird die Arbeitsweise – nicht die interne Objektakte.
        </p>
        <div className="mt-5">
          <NavLink
            to="/objektbetreuung-anfrage?anliegen=objektbetreuung"
            className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            Betreuung für Ihr Objekt anfragen
          </NavLink>
        </div>
      </LazySection>
    </div>
  );
}
