import { PropsWithChildren, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ADMIN_NAV } from "@/data/content";
import { Button } from "@/components/ui/Button";
import { prefetchRouteModule } from "@/lib/routeLoaders";

interface Props extends PropsWithChildren {
  userEmail: string;
  onLogout: () => Promise<void>;
}

export function AdminLayout({ children, userEmail, onLogout }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
    `relative shrink-0 whitespace-nowrap rounded-xl border px-4 py-3 text-[0.98rem] transition-all duration-180 xl:w-full ${
      isActive
        ? "border-[var(--line-strong)] bg-slate-900/70 pl-4 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_10px_24px_rgba(2,8,20,0.38)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-electric-300 before:shadow-[0_0_14px_rgba(56,189,248,0.7)]"
        : "border-transparent text-[var(--text-soft)] hover:border-[var(--line)] hover:bg-slate-900/60 hover:text-white"
    }`;

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `admin-mobile-menu-link ${isActive ? "admin-mobile-menu-link-active" : ""}`;

  const mobileDockItems = ADMIN_NAV.filter((item) =>
    ["/admin", "/admin/inbox", "/admin/tickets"].includes(item.href)
  );

  return (
    <div className="admin-ui admin-frame grid min-h-screen gap-4 py-4 xl:grid-cols-[270px_minmax(0,1fr)] max-xl:gap-3">
      <header className="admin-mobile-header xl:hidden">
        <img src="/kpt-logo.png" className="admin-mobile-logo" alt="" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="admin-mobile-brand">KusiPrimeTec Admin</p>
          <p className="admin-mobile-email">{userEmail}</p>
        </div>
        <button
          type="button"
          className="admin-mobile-header-menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? "Schließen" : "Menü"}
        </button>
      </header>

      <aside className="glass hidden self-start rounded-xl2 border border-[var(--line)] p-4 shadow-glass xl:sticky xl:top-4 xl:block">
        <div className="mb-5 flex items-center gap-3">
          <img
            src="/kpt-logo.png"
            className="h-14 w-14 rounded-xl border border-electric-300/30 bg-slate-900/50 p-1.5"
            alt="KusiPrimeTec"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold text-white">Robert Kusminov</p>
            <p className="truncate text-xs text-[var(--text-soft)]">Admin · {userEmail}</p>
          </div>
        </div>

        <nav className="grid gap-2">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/admin"}
              onMouseEnter={() => prefetchRouteModule(item.href)}
              onFocus={() => prefetchRouteModule(item.href)}
              className={desktopNavClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Sitzung</p>
          <div className="grid gap-2">
            <Button variant="secondary" onClick={() => navigate("/")}>
              Zur Website
            </Button>
            <Button variant="secondary" onClick={() => void onLogout()}>
              Abmelden
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-4 pb-4">{children}</main>

      {mobileMenuOpen ? (
        <div className="admin-mobile-menu-layer xl:hidden" role="presentation">
          <button
            type="button"
            className="admin-mobile-menu-backdrop"
            aria-label="Menü schließen"
            onClick={() => setMobileMenuOpen(false)}
          />
          <section id="admin-mobile-menu" className="admin-mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Admin-Menü">
            <div className="admin-mobile-menu-head">
              <div>
                <p className="admin-mobile-menu-eyebrow">Navigation</p>
                <h2 className="text-white">Bereich auswählen</h2>
              </div>
              <button type="button" className="admin-mobile-close" onClick={() => setMobileMenuOpen(false)}>
                Schließen
              </button>
            </div>
            <nav className="admin-mobile-menu-grid" aria-label="Alle Admin-Bereiche">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/admin"}
                  onMouseEnter={() => prefetchRouteModule(item.href)}
                  onFocus={() => prefetchRouteModule(item.href)}
                  className={mobileNavClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="admin-mobile-session-actions">
              <Button variant="secondary" onClick={() => navigate("/")}>Zur Website</Button>
              <Button variant="secondary" onClick={() => void onLogout()}>Abmelden</Button>
            </div>
          </section>
        </div>
      ) : null}

      <nav className="admin-mobile-dock xl:hidden" aria-label="Schnellnavigation">
        {mobileDockItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/admin"}
            className={({ isActive }: { isActive: boolean }) =>
              `admin-mobile-dock-link ${isActive ? "admin-mobile-dock-link-active" : ""}`
            }
          >
            {item.href === "/admin" ? "Start" : item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={`admin-mobile-dock-link ${mobileMenuOpen ? "admin-mobile-dock-link-active" : ""}`}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          Menü
        </button>
      </nav>
    </div>
  );
}
