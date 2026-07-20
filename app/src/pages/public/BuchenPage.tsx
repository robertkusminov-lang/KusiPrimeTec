import { NavLink } from "react-router-dom";
import { PUBLIC_PATHS } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";

export default function BuchenPage() {
  useSeo({
    title: "Anfragen & Kundenlogin | KusiPrimeTec",
    description:
      "Drei klare Wege: Einzelauftrag anfragen, ObjektBetreuung anfragen oder als bestehender Kunde im Kundenlogin Tickets für zugewiesene Objekte anlegen.",
  });

  return (
    <div className="page-enter page-stack">
      <header className="premium-card premium-card-strong page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Klar getrennte Wege</p>
        <h1 className="public-page-title mt-2 text-white">Anfrage oder Kundenlogin auswählen</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Öffentliche Einzelanfragen, laufende ObjektBetreuung und der Kundenlogin werden nicht mehr vermischt.
          Wählen Sie einfach den passenden Einstieg für Ihr Anliegen.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {PUBLIC_PATHS.map((entry) => (
          <article key={entry.href} className="premium-card flex h-full flex-col p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-electric-300">KusiPrimeTec</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{entry.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-soft)]">{entry.text}</p>
            <NavLink to={entry.href} className="btn-primary-premium mt-5 inline-flex w-fit rounded-full px-5 py-3 text-sm font-semibold">
              Öffnen
            </NavLink>
          </article>
        ))}
      </section>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Hinweis zum Kundenlogin</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
          Der Kundenlogin ist für bestehende Kunden mit freigeschaltetem Konto gedacht. Dort sind nur die vom Admin
          zugewiesenen Objekte und dazugehörigen Tickets sichtbar.
        </p>
      </section>
    </div>
  );
}
