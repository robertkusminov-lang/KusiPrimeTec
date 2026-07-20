import { NavLink } from "react-router-dom";
import { PUBLIC_PATHS } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function BuchenPage() {
  useSeo({
    title: "Anfragewege und Kundenlogin | KusiPrimeTec",
    description:
      "Drei klar getrennte Wege bei KusiPrimeTec: ObjektBetreuung oder ObjektCheck anfragen, operativen Einzelauftrag melden oder als Bestandskunde den Kundenlogin nutzen.",
    canonicalPath: "/buchen",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Drei getrennte Einstiege
          </p>
          <h1 className="hero-display text-white">Anfrageweg passend zum Anliegen auswählen.</h1>
          <p className="hero-support text-electric-100">
            Öffentliche Einzelaufträge, ObjektBetreuungs-Anfragen und der Kundenlogin bleiben fachlich getrennt. So landet jedes Anliegen im richtigen Prozess.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {PUBLIC_PATHS.map((entry, index) => (
          <article key={entry.href} className={`premium-card flex h-full flex-col p-5 ${index === 0 ? "border-electric-300/45 bg-electric-400/10" : ""}`}>
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">{index === 0 ? "Empfohlener Einstieg" : "KusiPrimeTec"}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{entry.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-soft)]">{entry.text}</p>
            <NavLink to={entry.href} className="btn-primary-premium mt-5 inline-flex min-h-[54px] w-fit items-center justify-center rounded-full px-5 py-3 text-sm font-semibold">
              Öffnen
            </NavLink>
          </article>
        ))}
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
