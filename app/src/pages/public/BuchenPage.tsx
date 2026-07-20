import { NavLink } from "react-router-dom";
import { PUBLIC_PATHS } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function BuchenPage() {
  const [primaryPath, ...secondaryPaths] = PUBLIC_PATHS;

  useSeo({
    title: "Anfragewege und Kundenlogin | KusiPrimeTec",
    description:
      "Vier klar getrennte Wege bei KusiPrimeTec: ObjektBetreuung anfragen, ObjektCheck buchen, operativen Einzelauftrag melden oder als Bestandskunde den Kundenlogin nutzen.",
    canonicalPath: "/buchen",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Vier getrennte Einstiege
          </p>
          <h1 className="hero-display text-white">Anfrageweg passend zum Anliegen auswählen.</h1>
          <p className="hero-support text-electric-100">
            ObjektBetreuung bleibt der bevorzugte Einstieg. ObjektCheck, Einzelauftrag und Kundenlogin bleiben fachlich getrennt, damit jedes Anliegen im richtigen Prozess landet.
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        <article className="premium-card premium-card-strong flex flex-col gap-4 p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{primaryPath.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">{primaryPath.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">{primaryPath.text}</p>
            </div>
            <span className="rounded-full border border-electric-200/45 bg-electric-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-200">
              Empfohlener Einstieg
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <NavLink to={primaryPath.href} className="btn-primary-premium inline-flex min-h-[54px] w-fit items-center justify-center rounded-full px-5 py-3 text-sm font-semibold">
              {primaryPath.buttonLabel}
            </NavLink>
            <NavLink to="/objektbetreuung" className="btn-secondary-premium inline-flex min-h-[54px] w-fit items-center justify-center rounded-full px-5 py-3 text-sm font-semibold">
              ObjektBetreuung ansehen
            </NavLink>
          </div>
        </article>

        <div className="grid gap-4 lg:grid-cols-3">
          {secondaryPaths.map((entry) => (
            <article key={entry.href} className="premium-card flex h-full flex-col p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{entry.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{entry.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-soft)]">{entry.text}</p>
              <NavLink to={entry.href} className="btn-secondary-premium mt-5 inline-flex min-h-[54px] w-fit items-center justify-center rounded-full px-5 py-3 text-sm font-semibold">
                {entry.buttonLabel}
              </NavLink>
            </article>
          ))}
        </div>
      </section>

      <section className="premium-card page-card">
        <h2 className="text-xl font-semibold text-white">Wichtig zur Trennung der Prozesse</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--line)] bg-slate-950/35 p-4 text-sm text-[var(--text-main)]">
            ObjektBetreuungs-Anfragen bleiben ein Interessenten- und Beratungsprozess.
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-slate-950/35 p-4 text-sm text-[var(--text-main)]">
            Einzelaufträge laufen weiterhin über den bestehenden operativen Ticket-Flow.
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-slate-950/35 p-4 text-sm text-[var(--text-main)]">
            Der Kundenlogin ist nur für bestehende, freigeschaltete Kunden mit zugewiesenen Objekten gedacht.
          </article>
        </div>
      </section>
    </div>
  );
}
