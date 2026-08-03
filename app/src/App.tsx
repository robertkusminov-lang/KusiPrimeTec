import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import HomePage from "@/pages/public/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";
import { loadAdminReportDocumentRoute, loadAdminRoute, loadCustomerReportRoute, loadPublicRoute } from "@/lib/routeLoaders";
import {
  clearStoredAdminSession,
  getStoredAdminSession,
  isStoredAdminSessionValid,
  saveStoredAdminSession,
} from "@/lib/adminAuth";
import { initGoogleTag, trackGooglePageView, updateGoogleTagConsent } from "@/lib/googleTag";
import { getAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/consent";

const LeistungenPage = lazy(loadPublicRoute("/leistungen"));
const HausmeisterservicePage = lazy(loadPublicRoute("/hausmeisterservice"));
const PreisePage = lazy(loadPublicRoute("/preise"));
const AblaufPage = lazy(loadPublicRoute("/ablauf"));
const ObjektbetreuungPage = lazy(loadPublicRoute("/objektbetreuung"));
const BuchenPage = lazy(loadPublicRoute("/buchen"));
const EinzelauftragPage = lazy(loadPublicRoute("/einzelauftrag"));
const ObjektbetreuungAnfragePage = lazy(loadPublicRoute("/objektbetreuung-anfrage"));
const CustomerAuthPage = lazy(loadPublicRoute("/konto/anmelden"));
const CustomerPortalPage = lazy(loadPublicRoute("/konto"));
const CustomerReportPage = lazy(loadCustomerReportRoute);
const ImpressumPage = lazy(loadPublicRoute("/impressum"));
const DatenschutzPage = lazy(loadPublicRoute("/datenschutz"));
const AgbPage = lazy(loadPublicRoute("/agb"));
const HaftungKoordinationPage = lazy(loadPublicRoute("/haftung-koordination"));
const WiderrufPage = lazy(loadPublicRoute("/widerruf"));
const AdminLoginPage = lazy(loadAdminRoute("/admin/login"));
const AdminDashboardPage = lazy(loadAdminRoute("/admin"));
const AdminInboxPage = lazy(loadAdminRoute("/admin/inbox"));
const AdminTicketsPage = lazy(loadAdminRoute("/admin/tickets"));
const AdminObjectsPage = lazy(loadAdminRoute("/admin/objekte"));
const AdminArchivePage = lazy(loadAdminRoute("/admin/archiv"));
const AdminTicketDetailPage = lazy(() => import("@/pages/admin/AdminTicketDetailPage"));
const AdminAnalyticsPage = lazy(loadAdminRoute("/admin/analytics"));
const AdminSettingsPage = lazy(loadAdminRoute("/admin/einstellungen"));
const AdminCustomersPage = lazy(loadAdminRoute("/admin/kunden"));
const AdminInteressentenPage = lazy(loadAdminRoute("/admin/interessenten"));
const AdminReportDocumentPage = lazy(loadAdminReportDocumentRoute);

function PublicTracking() {
  const location = useLocation();
  const [trackingEnabled, setTrackingEnabled] = useState(() => getAnalyticsConsent() === "granted");

  useEffect(() => {
    return subscribeAnalyticsConsent((value) => {
      const granted = value === "granted";
      updateGoogleTagConsent(granted);
      setTrackingEnabled(granted);
    });
  }, []);

  useEffect(() => {
    if (!trackingEnabled) return;
    initGoogleTag();
  }, [trackingEnabled]);

  useEffect(() => {
    if (!trackingEnabled) return;
    const pathWithQuery = `${location.pathname}${location.search}${location.hash}`;
    trackGooglePageView(pathWithQuery);
  }, [location.hash, location.pathname, location.search, trackingEnabled]);

  return null;
}

function PublicShell() {
  return (
    <SiteLayout>
      <PublicTracking />
      <Outlet />
    </SiteLayout>
  );
}

function RouteFallback() {
  return (
    <div className="narrow-frame mt-10">
      <div className="glass page-card rounded-xl2 border border-[var(--line)]">
        <h1 className="section-heading text-xl text-white">Seite wird geladen</h1>
        <LoadingSpinner className="mt-3" label="Modul wird vorbereitet..." />
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AdminShell() {
  const { session, ready } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [fallbackSession, setFallbackSession] = useState<Session | null>(null);
  const [storedSession, setStoredSession] = useState(() => getStoredAdminSession());
  const [sessionProbeRunning, setSessionProbeRunning] = useState(false);
  const [redirectAllowed, setRedirectAllowed] = useState(false);
  const effectiveToken = String(
    session?.access_token ||
      fallbackSession?.access_token ||
      ""
  );
  const effectiveEmail = String(
    session?.user?.email ||
      fallbackSession?.user?.email ||
      "admin"
  );

  useEffect(() => {
    const onSessionExpired = async () => {
      clearStoredAdminSession();
      setStoredSession(null);
      setFallbackSession(null);
      navigate("/admin/login", { replace: true, state: { from: location.pathname, reason: "expired" } });
    };
    const listener = () => {
      void onSessionExpired();
    };
    window.addEventListener("kpt:session-expired", listener);
    return () => window.removeEventListener("kpt:session-expired", listener);
  }, [fallbackSession?.access_token, location.pathname, navigate, storedSession]);

  useEffect(() => {
    if (session?.access_token) {
      saveStoredAdminSession(session);
      setStoredSession(getStoredAdminSession());
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const probeSession = async () => {
      if (!ready) {
        setSessionProbeRunning(false);
        return;
      }

      if (session?.access_token) {
        setFallbackSession(session);
        setSessionProbeRunning(false);
        return;
      }

      setSessionProbeRunning(true);
      for (let i = 0; i < 12; i += 1) {
        try {
          const { data: current } = await supabase.auth.getSession();
          if (!active) return;
          if (current.session?.access_token) {
            setFallbackSession(current.session);
            setSessionProbeRunning(false);
            return;
          }

          const refreshed = await supabase.auth.refreshSession();
          if (!active) return;
          if (!refreshed.error && refreshed.data.session?.access_token) {
            setFallbackSession(refreshed.data.session);
            setSessionProbeRunning(false);
            return;
          }

          const snapshot = getStoredAdminSession();
          if (!active) return;
          if (isStoredAdminSessionValid(snapshot)) {
            setStoredSession(snapshot);
            try {
              await supabase.auth.setSession({
                access_token: snapshot!.access_token,
                refresh_token: snapshot!.refresh_token,
              });
              const { data: rebound } = await supabase.auth.getSession();
              if (!active) return;
              if (rebound.session?.access_token) {
                setFallbackSession(rebound.session);
                saveStoredAdminSession(rebound.session);
                setStoredSession(getStoredAdminSession());
                setSessionProbeRunning(false);
                return;
              }
            } catch {
              // keep probing
            }
          }
        } catch {
          // transient auth error
        }
        if (i < 11) await delay(250);
      }

      if (!active) return;
      setSessionProbeRunning(false);
      setFallbackSession(null);
      setStoredSession(getStoredAdminSession());
    };

    void probeSession();
    return () => {
      active = false;
    };
  }, [ready, session]);

  useEffect(() => {
    if (!ready || sessionProbeRunning) {
      setRedirectAllowed(false);
      return;
    }
    if (effectiveToken) {
      setRedirectAllowed(false);
      return;
    }
    const id = window.setTimeout(() => setRedirectAllowed(true), 2400);
    return () => window.clearTimeout(id);
  }, [effectiveToken, ready, sessionProbeRunning]);

  if (!ready || sessionProbeRunning) {
    return (
      <div className="narrow-frame mt-10">
        <div className="glass page-card rounded-xl2 border border-[var(--line)]">
          <h1 className="section-heading text-xl text-white">Admin wird vorbereitet</h1>
          <LoadingSpinner className="mt-3" label="Sitzung wird geprüft..." />
          <p className="section-subtitle mt-2">
            Session wird geprüft. Falls dies länger dauert, Seite neu laden.
          </p>
        </div>
      </div>
    );
  }

  if (!effectiveToken) {
    if (!redirectAllowed) {
      return (
        <div className="narrow-frame mt-10">
          <div className="glass page-card rounded-xl2 border border-[var(--line)]">
            <h1 className="section-heading text-xl text-white">Admin wird vorbereitet</h1>
            <LoadingSpinner className="mt-3" label="Sitzung wird stabilisiert..." />
          </div>
        </div>
      );
    }
    return <Navigate to="/admin/login" replace state={{ from: location.pathname, reason: "expired" }} />;
  }

  return (
    <AdminLayout
      userEmail={effectiveEmail}
      onLogout={async () => {
        setFallbackSession(null);
        clearStoredAdminSession();
        setStoredSession(null);
        await supabase.auth.signOut();
      }}
    >
      <Outlet context={{ token: effectiveToken }} />
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/leistungen" element={<LazyRoute><LeistungenPage /></LazyRoute>} />
        <Route path="/hausmeisterservice" element={<LazyRoute><HausmeisterservicePage /></LazyRoute>} />
        <Route path="/objektbetreuung" element={<LazyRoute><ObjektbetreuungPage /></LazyRoute>} />
        <Route path="/preise" element={<LazyRoute><PreisePage /></LazyRoute>} />
        <Route path="/ablauf" element={<LazyRoute><AblaufPage /></LazyRoute>} />
        <Route path="/buchen" element={<LazyRoute><BuchenPage /></LazyRoute>} />
        <Route path="/einzelauftrag" element={<LazyRoute><EinzelauftragPage /></LazyRoute>} />
        <Route path="/objektbetreuung-anfrage" element={<LazyRoute><ObjektbetreuungAnfragePage /></LazyRoute>} />
        <Route path="/konto" element={<LazyRoute><CustomerPortalPage /></LazyRoute>} />
        <Route path="/konto/anmelden" element={<LazyRoute><CustomerAuthPage /></LazyRoute>} />
        <Route path="/konto/rapport/:id" element={<LazyRoute><CustomerReportPage /></LazyRoute>} />
        <Route path="/impressum" element={<LazyRoute><ImpressumPage /></LazyRoute>} />
        <Route path="/datenschutz" element={<LazyRoute><DatenschutzPage /></LazyRoute>} />
        <Route path="/agb" element={<LazyRoute><AgbPage /></LazyRoute>} />
        <Route path="/widerruf" element={<LazyRoute><WiderrufPage /></LazyRoute>} />
        <Route path="/haftung-koordination" element={<LazyRoute><HaftungKoordinationPage /></LazyRoute>} />
      </Route>

      <Route path="/admin/login" element={<LazyRoute><AdminLoginPage /></LazyRoute>} />
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<LazyRoute><AdminDashboardPage /></LazyRoute>} />
        <Route path="inbox" element={<LazyRoute><AdminInboxPage /></LazyRoute>} />
        <Route path="tickets" element={<LazyRoute><AdminTicketsPage /></LazyRoute>} />
        <Route path="interessenten" element={<LazyRoute><AdminInteressentenPage /></LazyRoute>} />
        <Route path="objekte" element={<LazyRoute><AdminObjectsPage /></LazyRoute>} />
        <Route path="kunden" element={<LazyRoute><AdminCustomersPage /></LazyRoute>} />
        <Route path="archiv" element={<LazyRoute><AdminArchivePage /></LazyRoute>} />
        <Route path="archive" element={<LazyRoute><AdminArchivePage /></LazyRoute>} />
        <Route path="tickets/:id" element={<LazyRoute><AdminTicketDetailPage /></LazyRoute>} />
        <Route path="docs/report/:id" element={<LazyRoute><AdminReportDocumentPage /></LazyRoute>} />
        <Route path="analytics" element={<LazyRoute><AdminAnalyticsPage /></LazyRoute>} />
        <Route path="einstellungen" element={<LazyRoute><AdminSettingsPage /></LazyRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
