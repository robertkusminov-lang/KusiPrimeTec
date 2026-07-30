import { NavLink } from "react-router-dom";
import { COMPANY_PROFILE } from "@/config/businessRules";
import { FOOTER_LINKS, NAV_PUBLIC } from "@/data/content";
import { openConsentSettings } from "@/lib/consent";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--line)] bg-[rgba(8,12,22,0.84)]">
      <div className="site-frame py-10">
        <div className="mb-8 h-px w-full bg-gradient-to-r from-transparent via-electric-300/45 to-transparent" />

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">KusiPrimeTec</h2>
            <p className="text-sm text-[var(--text-soft)]">
              Technischer Immobilienservice mit ergänzendem Objekt- & Hausmeisterservice für Wohn- und Gewerbeobjekte im Bestand.
            </p>
            <p className="text-xs text-[var(--text-muted)]">Störungsservice · Objekt- & Hausmeisterservice · Objektbetreuung · Projektkoordination</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Navigation</h2>
            <nav className="grid gap-2 text-sm text-[var(--text-soft)]">
              {NAV_PUBLIC.map((item) => (
                <NavLink key={item.href} to={item.href} className="transition-colors duration-200 hover:text-white">
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Rechtliches</h2>
            <nav className="grid gap-2 text-sm text-[var(--text-soft)]">
              {FOOTER_LINKS.map((item) => (
                <NavLink key={item.href} to={item.href} className="transition-colors duration-200 hover:text-white">
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                className="text-left transition-colors duration-200 hover:text-white"
                onClick={openConsentSettings}
              >
                Cookie-Einstellungen
              </button>
            </nav>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Kontakt</h2>
            <div className="grid gap-2 text-sm text-[var(--text-soft)]">
              <p>Robert Kusminov</p>
              <p>{COMPANY_PROFILE.addressLine}</p>
              <a href="tel:+491776364393" className="transition-colors duration-200 hover:text-white">Telefon: 0177 6364393</a>
              <a
                href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20habe%20eine%20Anfrage."
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-200 hover:text-white"
              >
                WhatsApp: Direkt-Chat öffnen
              </a>
              <a href="mailto:info@kusiprimetec.de" className="transition-colors duration-200 hover:text-white">E-Mail: info@kusiprimetec.de</a>
              <p>{COMPANY_PROFILE.serviceRadiusLine}</p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs text-[var(--text-soft)]">
          <p>© {new Date().getFullYear()} KusiPrimeTec. Alle Rechte vorbehalten.</p>
          <p>Technischer Immobilienservice · Transparente Preisstruktur · Saubere Leistungsabgrenzung</p>
        </div>
      </div>
    </footer>
  );
}
