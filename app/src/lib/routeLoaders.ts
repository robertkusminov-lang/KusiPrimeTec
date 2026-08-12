import type { ComponentType } from "react";

type LoaderModule = { default: ComponentType<unknown> };

const publicRouteLoaders: Record<string, () => Promise<LoaderModule>> = {
  "/leistungen": () => import("@/pages/public/LeistungenPage"),
  "/hausmeisterservice": () => import("@/pages/public/HausmeisterservicePage"),
  "/preise": () => import("@/pages/public/PreisePage"),
  "/ablauf": () => import("@/pages/public/AblaufPage"),
  "/objektbetreuung": () => import("@/pages/public/ObjektbetreuungPage"),
  "/objektcheck": () => import("@/pages/public/ObjectCheckPage"),
  "/hausmeisterservice-schorndorf": () => import("@/pages/public/HausmeisterserviceSchorndorfPage"),
  "/objektbetreuung-remstal": () => import("@/pages/public/ObjektbetreuungRemstalPage"),
  "/technischer-stoerungsservice-schorndorf": () => import("@/pages/public/TechnischerStoerungsserviceSchorndorfPage"),
  "/buchen": () => import("@/pages/public/BuchenPage"),
  "/einzelauftrag": () => import("@/pages/public/EinzelauftragPage"),
  "/objektbetreuung-anfrage": () => import("@/pages/public/ObjektbetreuungAnfragePage"),
  "/konto": () => import("@/pages/customer/CustomerPortalPage"),
  "/konto/anmelden": () => import("@/pages/customer/CustomerAuthPage"),
  "/impressum": () => import("@/pages/legal/ImpressumPage"),
  "/datenschutz": () => import("@/pages/legal/DatenschutzPage"),
  "/agb": () => import("@/pages/legal/AgbPage"),
  "/widerruf": () => import("@/pages/legal/WiderrufPage"),
  "/haftung-koordination": () => import("@/pages/legal/HaftungKoordinationPage"),
};

const adminRouteLoaders: Record<string, () => Promise<LoaderModule>> = {
  "/admin/login": () => import("@/pages/admin/AdminLoginPage"),
  "/admin": () => import("@/pages/admin/AdminDashboardPage"),
  "/admin/inbox": () => import("@/pages/admin/AdminInboxPage"),
  "/admin/tickets": () => import("@/pages/admin/AdminTicketsPage"),
  "/admin/interessenten": () => import("@/pages/admin/AdminInteressentenPage"),
  "/admin/objekte": () => import("@/pages/admin/AdminObjectsPage"),
  "/admin/kunden": () => import("@/pages/admin/AdminCustomersPage"),
  "/admin/archiv": () => import("@/pages/admin/AdminArchivePage"),
  "/admin/archive": () => import("@/pages/admin/AdminArchivePage"),
  "/admin/analytics": () => import("@/pages/admin/AdminAnalyticsPage"),
  "/admin/einstellungen": () => import("@/pages/admin/AdminSettingsPage"),
};

function normalizePath(path: string): string {
  const clean = String(path || "").trim();
  if (!clean) return "/";
  return clean.replace(/\/+$/, "") || "/";
}

export function loadPublicRoute(path: string): () => Promise<LoaderModule> {
  const normalized = normalizePath(path);
  const loader = publicRouteLoaders[normalized];
  if (!loader) throw new Error(`Unbekannter Public-Route-Loader für ${normalized}`);
  return loader;
}

export function loadAdminRoute(path: string): () => Promise<LoaderModule> {
  const normalized = normalizePath(path);
  const loader = adminRouteLoaders[normalized];
  if (!loader) throw new Error(`Unbekannter Admin-Route-Loader für ${normalized}`);
  return loader;
}

export async function loadAdminReportDocumentRoute(): Promise<LoaderModule> {
  const module = await import("@/pages/admin/AdminDocumentEditorPage");
  return { default: module.AdminReportDocumentPage as unknown as ComponentType<unknown> };
}

export async function loadCustomerReportRoute(): Promise<LoaderModule> {
  const module = await import("@/pages/customer/CustomerReportPage");
  return { default: module.default as unknown as ComponentType<unknown> };
}

export function prefetchRouteModule(path: string): void {
  const normalized = normalizePath(path);

  if (normalized.startsWith("/admin/tickets/")) {
    void import("@/pages/admin/AdminTicketDetailPage");
    return;
  }

  if (normalized.startsWith("/admin/docs/report/")) {
    void loadAdminReportDocumentRoute();
    return;
  }

  if (normalized.startsWith("/konto/rapport/")) {
    void loadCustomerReportRoute();
    return;
  }

  const loader = publicRouteLoaders[normalized] || adminRouteLoaders[normalized];
  if (!loader) return;
  void loader();
}
