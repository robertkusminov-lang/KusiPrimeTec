import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ENV } from "@/lib/env";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeOpenConsentSettings,
  type AnalyticsConsentState,
} from "@/lib/consent";

export function ConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsentState>(() => getAnalyticsConsent());

  useEffect(() => subscribeOpenConsentSettings(() => setConsent(null)), []);

  if (!ENV.googleTagIds.length || consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="mx-auto mb-3 w-full max-w-4xl rounded-2xl border border-[var(--line)] bg-[rgba(8,12,22,0.96)] p-4 shadow-[0_20px_42px_rgba(2,8,20,0.55)] backdrop-blur">
        <p className="text-sm font-semibold text-white">Datenschutzeinstellungen</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-soft)] md:text-sm">
          Wir nutzen optionale Analyse-Technologien (Google Tag), um Reichweite und Seitenleistung zu messen. Sie können Ihre Auswahl jederzeit ändern.
          Details finden Sie in unserer{" "}
          <NavLink to="/datenschutz" className="text-electric-300 hover:text-electric-200">
            Datenschutzerklärung
          </NavLink>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary-premium rounded-full px-4 py-2 text-xs font-semibold md:text-sm"
            onClick={() => {
              setAnalyticsConsent("denied");
              setConsent("denied");
            }}
          >
            Nur notwendige
          </button>
          <button
            type="button"
            className="btn-primary-premium rounded-full px-4 py-2 text-xs font-semibold md:text-sm"
            onClick={() => {
              setAnalyticsConsent("granted");
              setConsent("granted");
            }}
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}

