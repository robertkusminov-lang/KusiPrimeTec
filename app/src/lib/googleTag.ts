import { ENV } from "@/lib/env";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

function ensureGtagScript(tagId: string) {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-kpt-gtag="${tagId}"]`);
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
  script.setAttribute("data-kpt-gtag", tagId);
  document.head.appendChild(script);
}

export function initGoogleTag() {
  const tagId = ENV.googleTagId;
  if (!tagId || initialized || typeof window === "undefined") return;

  ensureGtagScript(tagId);

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

  window.gtag("js", new Date());
  window.gtag("config", tagId, { anonymize_ip: true, send_page_view: false });

  initialized = true;
}

export function trackGooglePageView(path: string) {
  const tagId = ENV.googleTagId;
  if (!tagId || typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: tagId,
  });
}

