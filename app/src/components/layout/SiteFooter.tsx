import { NavLink } from "react-router-dom";
import { COMPANY_PROFILE } from "@/config/businessRules";
import { FOOTER_LINKS, NAV_PUBLIC, NAV_PUBLIC_SECONDARY } from "@/data/content";
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
              Persönlicher technischer Immobilienservice für Gewerbeobjekte und Bestandsimmobilien mit klaren Abläufen, digitaler Dokumentation und persönlicher Betreuung.
            </p>
            <p className="text-xs text-[var(--text-muted)]">ObjektBetreuung | ObjektCheck | Einzelauftrag | Projektkoordination</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Hauptnavigation</h2>
            <nav className="grid gap-2 text-sm text-[var(--text-soft)]">
              {NAV_PUBLIC.filter((item) => item.href !== "/konto/anmelden").map((item) => (
                <NavLink key={item.href} to={item.href} className="transition-colors duration-200 hover:text-white">
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Weitere Seiten</h2>
            <nav className="grid gap-2 text-sm text-[var(--text-soft)]">
              {NAV_PUBLIC_SECONDARY.map((item) => (
                <NavLink key={item.href} to={item.href} className="transition-colors duration-200 hover:text-white">
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="grid gap-2 pt-2 text-sm text-[var(--text-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Rechtliches</p>
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
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Kontakt</h2>
            <div className="grid gap-2 text-sm text-[var(--text-soft)]">
              <p>{COMPANY_PROFILE.ownerName}</p>
              <p>{COMPANY_PROFILE.addressLine}</p>
              <a href={`tel:${COMPANY_PROFILE.phoneHref}`} className="transition-colors duration-200 hover:text-white">
                Telefon: {COMPANY_PROFILE.phoneDisplay}
              </a>
              <a
                href={COMPANY_PROFILE.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-200 hover:text-white"
              >
                WhatsApp: Direkt-Chat öffnen
              </a>
              <a href={`mailto:${COMPANY_PROFILE.email}`} className="transition-colors duration-200 hover:text-white">
                E-Mail: {COMPANY_PROFILE.email}
              </a>
              <p>{COMPANY_PROFILE.serviceRadiusLine}</p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs text-[var(--text-soft)]">
          <p>© {new Date().getFullYear()} KusiPrimeTec. Alle Rechte vorbehalten.</p>
          <p>Technischer Immobilienservice | Strukturierte Betreuung | Saubere Leistungsabgrenzung</p>
        </div>
      </div>
    </footer>
  );
}
