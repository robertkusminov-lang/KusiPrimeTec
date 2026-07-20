import { PropsWithChildren, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ConsentBanner } from "./ConsentBanner";

const LEGAL_PATHS = new Set([
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/haftung-koordination",
]);

export function SiteLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const hideMobileCta =
    location.pathname === "/buchen" ||
    location.pathname === "/objektbetreuung-anfrage" ||
    location.pathname.startsWith("/konto") ||
    LEGAL_PATHS.has(location.pathname);
  const showMobileCta = !hideMobileCta;
  const [stickyVisible, setStickyVisible] = useState(false);

  const stickyCta =
    location.pathname === "/objektcheck"
      ? {
          href: "/objektbetreuung-anfrage?anliegen=objektcheck",
          label: "ObjektCheck anfragen",
        }
      : location.pathname === "/einzelauftrag"
        ? {
            href: "/einzelauftrag",
            label: "Einzelauftrag anfragen",
          }
        : {
            href: "/objektbetreuung-anfrage?anliegen=objektbetreuung",
            label: "ObjektBetreuung anfragen",
          };

  useEffect(() => {
    if (!showMobileCta) {
      setStickyVisible(false);
      return;
    }
    const onScroll = () => {
      setStickyVisible(window.scrollY > 340);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showMobileCta, location.pathname]);

  return (
    <div className="premium-shell min-h-screen">
      <SiteHeader />
      <main className="site-frame py-[clamp(2rem,4vw,3rem)] pb-24 md:pb-12">{children}</main>
      <SiteFooter />
      <ConsentBanner />

      {showMobileCta ? (
        <div className={`mobile-sticky-cta fixed bottom-4 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0px)] lg:hidden ${stickyVisible ? "visible" : ""}`}>
          <NavLink to={stickyCta.href} className="btn-primary-premium cta-pulse mx-auto flex w-full max-w-md items-center justify-center rounded-full px-6 py-3 text-sm font-semibold">
            {stickyCta.label}
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}
