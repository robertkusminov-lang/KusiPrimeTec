import { normalizeUiErrorMessage, SESSION_EXPIRED_MESSAGE, isAuthTokenErrorMessage } from "./errors";
import { clearStoredAdminSession, getStoredAdminSession, isStoredAdminSessionValid, saveStoredAdminSession } from "./adminAuth";
import { ENV } from "./env";
import { supabase } from "./supabase";

type ApiError = Error & {
  rawMessage?: string;
  status?: number;
};

let sessionExpiryHandling = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof atob === "function") {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

function isLikelyUsableJwt(token: string | undefined, minTtlMs = 15_000): boolean {
  const raw = String(token || "").trim();
  if (!raw) return false;
  const payload = decodeJwtPayload(raw);
  if (!payload) return true;
  const exp = Number(payload.exp || 0);
  if (!exp) return true;
  return exp * 1000 > Date.now() + minTtlMs;
}

async function tryRecoverSessionFromStoredSnapshot(): Promise<string | undefined> {
  const snapshot = getStoredAdminSession();
  if (!snapshot?.access_token || !snapshot.refresh_token) return undefined;

  try {
    const rebound = await supabase.auth.setSession({
      access_token: snapshot.access_token,
      refresh_token: snapshot.refresh_token,
    });
    if (!rebound.error && rebound.data.session?.access_token) {
      saveStoredAdminSession(rebound.data.session);
      return rebound.data.session.access_token;
    }
  } catch {
    // continue
  }

  try {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      saveStoredAdminSession(refreshed.data.session);
      return refreshed.data.session.access_token;
    }
  } catch {
    // continue
  }

  return undefined;
}

async function hasStableSessionToken(attempts = 5, waitMs = 180): Promise<boolean> {
  const snapshot = getStoredAdminSession();
  if (isStoredAdminSessionValid(snapshot)) return true;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) return true;
    } catch {
      // ignore transient read errors
    }
    if (i < attempts - 1) await delay(waitMs);
  }
  return false;
}

async function handleSessionExpiredSideEffects(): Promise<boolean> {
  if (sessionExpiryHandling) return false;
  sessionExpiryHandling = true;
  try {
    const snapshot = getStoredAdminSession();
    if (isStoredAdminSessionValid(snapshot)) {
      try {
        await supabase.auth.setSession({
          access_token: snapshot!.access_token,
          refresh_token: snapshot!.refresh_token,
        });
      } catch {
        // Stale snapshot; continue with normal expiry handling.
      }
    }

    if (await hasStableSessionToken(6, 180)) {
      return false;
    }

    const { data: current } = await supabase.auth.getSession();
    const currentToken = current.session?.access_token || "";
    if (currentToken) {
      const expiryMs = Number(current.session?.expires_at || 0) * 1000;
      if (!expiryMs || expiryMs > Date.now() + 15_000) {
        return false;
      }
    }

    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      return false;
    }

    if (await hasStableSessionToken(6, 220)) {
      return false;
    }

    await supabase.auth.signOut();
    clearStoredAdminSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kpt:session-expired"));
    }
    return true;
  } catch {
    // UI-Fehlerbild bleibt gleich; Redirect passiert über Session-Hook.
    return false;
  } finally {
    sessionExpiryHandling = false;
  }
}

function isSupabaseFunctionsBase(): boolean {
  const base = String(ENV.apiBase || "").toLowerCase();
  return (
    base.includes(".functions.supabase.co") ||
    base.includes("/functions/v1") ||
    base === "/api" ||
    base.startsWith("/api/")
  );
}

function buildHeaders(token?: string, withJsonBody = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (withJsonBody) headers["content-type"] = "application/json; charset=utf-8";

  const useSupabaseHeaders = isSupabaseFunctionsBase() && Boolean(ENV.supabaseAnonKey);
  if (useSupabaseHeaders) headers.apikey = ENV.supabaseAnonKey;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (useSupabaseHeaders) {
    // Public Edge Functions can require auth header even without user session.
    headers.Authorization = `Bearer ${ENV.supabaseAnonKey}`;
  }

  return headers;
}

async function resolveAccessToken(providedToken?: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      const recoveredFromError = await tryRecoverSessionFromStoredSnapshot();
      if (recoveredFromError) return recoveredFromError;
      return isLikelyUsableJwt(providedToken) ? providedToken : undefined;
    }

    const session = data.session;
    if (!session?.access_token) {
      const recovered = await tryRecoverSessionFromStoredSnapshot();
      if (recovered) return recovered;
      return isLikelyUsableJwt(providedToken) ? providedToken : undefined;
    }

    const expiryMs = Number(session.expires_at || 0) * 1000;
    const willExpireSoon = expiryMs > 0 && expiryMs <= Date.now() + 60_000;
    if (!willExpireSoon) {
      saveStoredAdminSession(session);
      return session.access_token;
    }

    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      saveStoredAdminSession(refreshed.data.session);
      return refreshed.data.session.access_token;
    }
    if (isLikelyUsableJwt(session.access_token)) return session.access_token;
    return isLikelyUsableJwt(providedToken) ? providedToken : undefined;
  } catch {
    const recovered = await tryRecoverSessionFromStoredSnapshot();
    if (recovered) return recovered;
    return isLikelyUsableJwt(providedToken) ? providedToken : undefined;
  }
}

function shouldTreatAsAuthFailure(status: number, message: string, wasAuthenticatedRequest: boolean): boolean {
  if (!wasAuthenticatedRequest) return false;
  if (status === 401) return isAuthTokenErrorMessage(message);
  return isAuthTokenErrorMessage(message);
}

function normalizeHttpErrorMessage(status: number, rawMessage: unknown): string {
  if (status === 403) return "Keine Berechtigung für den Adminbereich.";
  return normalizeUiErrorMessage(rawMessage || `HTTP ${status}`);
}

function createApiError(message: string, rawMessage?: unknown, status?: number): ApiError {
  const error = new Error(message) as ApiError;
  error.rawMessage = String(rawMessage || "").trim();
  if (typeof status === "number") error.status = status;
  return error;
}

async function readResponseErrorMessage(res: Response): Promise<string> {
  try {
    const isJson = String(res.headers.get("content-type") || "").includes("application/json");
    if (isJson) {
      const data = (await res.clone().json()) as { error?: string; message?: string } | string;
      if (typeof data === "string") return data;
      return String(data?.error || data?.message || "").trim();
    }
    return String(await res.clone().text()).trim();
  } catch {
    return "";
  }
}

async function withAuthRefreshRetry(
  execute: (token: string | undefined) => Promise<Response>,
  options: { providedToken?: string; wasAuthenticatedRequest: boolean }
): Promise<Response> {
  let authToken = await assertAuthenticatedToken(options.providedToken);
  let res = await execute(authToken);

  if (!options.wasAuthenticatedRequest || res.status !== 401) {
    return res;
  }

  const rawMessage = await readResponseErrorMessage(res);
  if (!isAuthTokenErrorMessage(rawMessage || "401")) {
    return res;
  }

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    return res;
  }
  saveStoredAdminSession(refreshed.data.session);

  authToken = refreshed.data.session.access_token;
  return await execute(authToken);
}

async function parseResponse<T>(
  res: Response,
  options: { wasAuthenticatedRequest: boolean }
): Promise<T> {
  const isJson = String(res.headers.get("content-type") || "").includes("application/json");

  if (!isJson) {
    const text = await res.text();
      const message = normalizeHttpErrorMessage(res.status, text);
      if (!res.ok) {
        if (shouldTreatAsAuthFailure(res.status, message, options.wasAuthenticatedRequest)) {
          const invalidated = await handleSessionExpiredSideEffects();
          throw createApiError(invalidated ? SESSION_EXPIRED_MESSAGE : message, text, res.status);
        }
        throw createApiError(message, text, res.status);
      }
    throw createApiError("Unerwartete API-Antwort (kein JSON). Bitte VITE_API_BASE prüfen.", text, res.status);
  }

  const data = (await res.json()) as T & { error?: string; message?: string };

  if (!res.ok) {
    const rawMessage = typeof data === "string" ? data : data?.error || data?.message || `HTTP ${res.status}`;
    const message = normalizeHttpErrorMessage(res.status, rawMessage);
    if (shouldTreatAsAuthFailure(res.status, String(rawMessage || ""), options.wasAuthenticatedRequest)) {
      const invalidated = await handleSessionExpiredSideEffects();
      throw createApiError(invalidated ? SESSION_EXPIRED_MESSAGE : message, rawMessage, res.status);
    }
    throw createApiError(message, rawMessage, res.status);
  }

  // Einige Backends liefern Fehlertexte trotz HTTP 200 in einem JSON-Feld.
  if (typeof data === "object" && data !== null && typeof data.error === "string" && data.error.trim()) {
    const message = normalizeUiErrorMessage(data.error);
    if (shouldTreatAsAuthFailure(res.status, data.error, options.wasAuthenticatedRequest)) {
      const invalidated = await handleSessionExpiredSideEffects();
      throw createApiError(invalidated ? SESSION_EXPIRED_MESSAGE : message, data.error, res.status);
    }
    throw createApiError(message, data.error, res.status);
  }

  return data;
}

async function assertAuthenticatedToken(providedToken?: string): Promise<string | undefined> {
  if (!providedToken) return undefined;
  const token = await resolveAccessToken(providedToken);
  if (!token) {
    const invalidated = await handleSessionExpiredSideEffects();
    throw new Error(invalidated ? SESSION_EXPIRED_MESSAGE : "Session-Token fehlt.");
  }
  return token;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const wasAuthenticatedRequest = Boolean(token);
  const res = await withAuthRefreshRetry(
    (authToken) =>
      fetch(`${ENV.apiBase}/${path}`, {
        headers: buildHeaders(authToken),
      }),
    { providedToken: token, wasAuthenticatedRequest }
  );
  return parseResponse<T>(res, { wasAuthenticatedRequest });
}

export async function apiPost<TReq, TRes>(path: string, body: TReq, token?: string): Promise<TRes> {
  const wasAuthenticatedRequest = Boolean(token);
  const res = await withAuthRefreshRetry(
    (authToken) =>
      fetch(`${ENV.apiBase}/${path}`, {
        method: "POST",
        headers: buildHeaders(authToken, true),
        body: JSON.stringify(body),
      }),
    { providedToken: token, wasAuthenticatedRequest }
  );
  return parseResponse<TRes>(res, { wasAuthenticatedRequest });
}
