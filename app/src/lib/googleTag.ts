import { ENV } from "@/lib/env";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function updateGoogleTagConsent(granted: boolean) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const consent = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: consent,
    ad_user_data: consent,
    ad_personalization: consent,
    analytics_storage: consent,
  });
}

function ensureGtagScript(tagId: string) {
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-kpt-gtag], script[src^="https://www.googletagmanager.com/gtag/js"]',
  );
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
  script.setAttribute("data-kpt-gtag", tagId);
  document.head.appendChild(script);
}

export function initGoogleTag() {
  const tagIds = ENV.googleTagIds;
  if (!tagIds.length || initialized || typeof window === "undefined") return;

  const gtagAlreadyAvailable = typeof window.gtag === "function";
  ensureGtagScript(tagIds[0]);

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

  if (!gtagAlreadyAvailable) window.gtag("js", new Date());
  updateGoogleTagConsent(true);
  tagIds.forEach((tagId) => {
    window.gtag?.("config", tagId, { anonymize_ip: true, send_page_view: false });
  });

  initialized = true;
}

export function trackGooglePageView(path: string) {
  const tagIds = ENV.googleTagIds;
  if (!tagIds.length || typeof window === "undefined" || typeof window.gtag !== "function") return;

  tagIds.forEach((tagId) => {
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: tagId,
    });
  });
}

