import { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ADMIN_NAV } from "@/data/content";
import { Button } from "@/components/ui/Button";
import { prefetchRouteModule } from "@/lib/routeLoaders";

interface Props extends PropsWithChildren {
  userEmail: string;
  onLogout: () => Promise<void>;
}

export function AdminLayout({ children, userEmail, onLogout }: Props) {
  const navigate = useNavigate();

  return (
    <div className="admin-ui admin-frame grid min-h-screen gap-4 py-4 xl:grid-cols-[270px_minmax(0,1fr)] max-xl:gap-3">
      <aside className="glass self-start rounded-xl2 border border-[var(--line)] p-4 shadow-glass xl:sticky xl:top-4 max-sm:p-4">
        <div className="mb-5 flex items-center gap-3">
          <img
            src="/kpt-logo.png"
            className="h-16 w-16 rounded-xl border border-electric-300/30 bg-slate-900/50 p-1.5 sm:h-14 sm:w-14"
            alt="KusiPrimeTec"
          />
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold text-white sm:text-base">Robert Kusminov</p>
            <p className="truncate text-sm text-[var(--text-soft)] sm:text-xs">Admin · {userEmail}</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onMouseEnter={() => prefetchRouteModule(item.href)}
              onFocus={() => prefetchRouteModule(item.href)}
              className={({ isActive }: { isActive: boolean }) =>
                `relative shrink-0 whitespace-nowrap rounded-xl border px-4 py-3 text-[0.98rem] transition-all duration-180 sm:px-3 sm:py-2 sm:text-sm xl:w-full ${
                  isActive
                    ? "border-[var(--line-strong)] bg-slate-900/70 pl-4 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_10px_24px_rgba(2,8,20,0.38)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-electric-300 before:shadow-[0_0_14px_rgba(56,189,248,0.7)]"
                    : "border-transparent text-[var(--text-soft)] hover:border-[var(--line)] hover:bg-slate-900/60 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[var(--text-soft)] sm:text-[11px]">Sitzung</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
    </div>
  );
}
