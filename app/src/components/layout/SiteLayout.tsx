import { PropsWithChildren, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ConsentBanner } from "./ConsentBanner";
import { getMobileStickyCta, shouldHideMobileStickyCta } from "@/lib/publicCta";

export function SiteLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const showMobileCta = !shouldHideMobileStickyCta(location.pathname);
  const stickyCta = getMobileStickyCta(location.pathname);
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
      <main className="site-frame py-[clamp(2rem,4vw,3rem)] pb-28 md:pb-12">{children}</main>
      <SiteFooter />
      <ConsentBanner />

      {showMobileCta && stickyCta ? (
        <div
          className={`mobile-sticky-cta fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 px-4 lg:hidden ${
            stickyVisible ? "visible" : ""
          }`}
        >
          <NavLink
            to={stickyCta.href}
            className="btn-primary-premium mx-auto flex w-full max-w-md items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            {stickyCta.label}
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}
