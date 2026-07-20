import { PropsWithChildren, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ConsentBanner } from "./ConsentBanner";

export function SiteLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const showMobileCta = location.pathname !== "/buchen";
  const [stickyVisible, setStickyVisible] = useState(false);

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
          <NavLink to="/buchen" className="btn-primary-premium cta-pulse mx-auto flex w-full max-w-md items-center justify-center rounded-full px-6 py-3 text-sm font-semibold">
            Jetzt Hilfe anfordern
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}
