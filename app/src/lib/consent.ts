export type AnalyticsConsentState = "granted" | "denied" | null;

const ANALYTICS_CONSENT_KEY = "kpt_analytics_consent";
const ANALYTICS_EVENT = "kpt:analytics-consent-changed";
const OPEN_SETTINGS_EVENT = "kpt:open-consent-settings";

export function getAnalyticsConsent(): AnalyticsConsentState {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return raw === "granted" || raw === "denied" ? raw : null;
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsentState, null>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: value }));
}

export function clearAnalyticsConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: null }));
}

export function subscribeAnalyticsConsent(handler: (value: AnalyticsConsentState) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AnalyticsConsentState>).detail ?? getAnalyticsConsent();
    handler(detail);
  };
  window.addEventListener(ANALYTICS_EVENT, listener);
  return () => window.removeEventListener(ANALYTICS_EVENT, listener);
}

export function openConsentSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

export function subscribeOpenConsentSettings(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OPEN_SETTINGS_EVENT, handler);
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
}

