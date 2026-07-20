import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { COMPANY_PROFILE } from "@/config/businessRules";
import { NAV_PUBLIC } from "@/data/content";
import { prefetchRouteModule } from "@/lib/routeLoaders";
import { supabase } from "@/lib/supabase";

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <NavLink
      to={href}
      onMouseEnter={() => prefetchRouteModule(href)}
      onFocus={() => prefetchRouteModule(href)}
      className={({ isActive }: { isActive: boolean }) =>
        clsx(
          "nav-link header-chip border px-3.5 py-2 text-sm transition-all duration-200",
          isActive
            ? "nav-link-active border-electric-300/70 bg-slate-900/72 text-white shadow-[0_12px_28px_rgba(2,8,20,0.46)]"
            : "border-transparent text-[var(--text-soft)] hover:border-[var(--line)] hover:bg-slate-900/60 hover:text-white",
        )
      }
    >
      {label}
    </NavLink>
  );
}

function Burger({ open }: { open: boolean }) {
  return (
    <span className="relative h-4 w-4">
      <span
        className={clsx(
          "absolute left-0 top-0 h-[2px] w-4 bg-slate-100 transition-transform duration-200",
          open && "translate-y-[7px] rotate-45",
        )}
      />
      <span
        className={clsx(
          "absolute left-0 top-[7px] h-[2px] w-4 bg-slate-100 transition-opacity duration-200",
          open && "opacity-0",
        )}
      />
      <span
        className={clsx(
          "absolute left-0 top-[14px] h-[2px] w-4 bg-slate-100 transition-transform duration-200",
          open && "-translate-y-[7px] -rotate-45",
        )}
      />
    </span>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const location = useLocation();

  const mainNavItems = NAV_PUBLIC.filter((item) => item.href !== "/konto");
  const accountHref = isSignedIn ? "/konto" : "/konto/anmelden";
  const accountLabel = isSignedIn ? "Kundenportal" : "Kundenlogin";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsSignedIn(Boolean(data.session?.access_token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.access_token));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 nav-glass">
      <div className="header-frame flex items-center justify-between gap-3 py-3.5 xl:gap-4">
        <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-3 xl:flex-none xl:min-w-[260px] 2xl:min-w-[300px]">
          <div className="logo-glow hero-logo-pulse aspect-square h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-electric-300/25 bg-slate-950/65 p-0.5 md:h-[70px] md:w-[70px]">
            <img src="/kpt-logo.png" alt="KusiPrimeTec Logo" className="h-full w-full scale-[1.32] object-contain" loading="eager" />
          </div>
          <div className="min-w-0">
            <img src="/publickpt-wordmark.png" alt="KusiPrimeTec" className="hidden h-10 w-auto max-w-full object-contain sm:block xl:h-12 2xl:h-[64px]" loading="eager" />
            <p className="font-semibold sm:hidden">KusiPrimeTec</p>
            <p className="mt-0.5 text-xs font-semibold leading-snug text-electric-100 sm:text-sm md:text-base">{COMPANY_PROFILE.tagline}</p>
          </div>
        </NavLink>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
          {mainNavItems.map((item) => (
            <LinkItem key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <a
            href="tel:+491776364393"
            className="header-chip hidden h-10 items-center gap-2 whitespace-nowrap rounded-full border border-electric-300/35 bg-slate-900/55 px-4 text-sm font-semibold text-electric-200 transition hover:border-electric-200/60 hover:text-white 2xl:inline-flex"
          >
            <span>Telefon</span>
            <span className="hidden tracking-[0.02em] min-[1760px]:inline">0177 6364393</span>
          </a>
          <NavLink
            to={accountHref}
            onMouseEnter={() => prefetchRouteModule(accountHref)}
            onFocus={() => prefetchRouteModule(accountHref)}
            className={({ isActive }: { isActive: boolean }) =>
              clsx(
                "nav-link header-chip hidden h-10 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-all duration-200 xl:inline-flex",
                isActive
                  ? "nav-link-active border-electric-300/70 bg-slate-900/72 text-white shadow-[0_12px_28px_rgba(2,8,20,0.46)]"
                  : "border-[var(--line)] text-[var(--text-soft)] hover:border-electric-300/45 hover:bg-slate-900/60 hover:text-white",
              )
            }
          >
            {accountLabel}
          </NavLink>
          <button
            type="button"
            aria-label="Navigation öffnen"
            className="btn-secondary-premium inline-flex h-10 w-10 items-center justify-center rounded-xl xl:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            <Burger open={open} />
          </button>
        </div>
      </div>

      <div className={clsx("header-frame overflow-hidden transition-all duration-200 xl:hidden", open ? "max-h-[calc(100vh-88px)] overflow-y-auto pb-3" : "max-h-0")}>
        <div className="premium-card grid gap-1 p-2">
          {mainNavItems.map((item) => (
            <LinkItem key={item.href} href={item.href} label={item.label} />
          ))}
          <LinkItem href={accountHref} label={accountLabel} />
          <a href="tel:+491776364393" className="btn-secondary-premium header-chip mt-1 inline-flex items-center justify-center px-3 py-2 text-sm font-semibold">
            Telefon 0177 6364393
          </a>
          <a
            href="https://wa.me/491776364393?text=Hallo%20KusiPrimeTec%2C%20ich%20brauche%20Unterstützung."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary-premium header-chip inline-flex items-center justify-center px-3 py-2 text-sm font-semibold"
          >
            WhatsApp Kontakt
          </a>
        </div>
      </div>
    </header>
  );
}
