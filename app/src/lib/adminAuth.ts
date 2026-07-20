import type { Session } from "@supabase/supabase-js";
import { ENV } from "./env";

const ADMIN_SESSION_KEY = "kpt_admin_session_v1";

export interface StoredAdminSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_email: string;
}

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
    // fallback below
  }

  try {
    const maybeBuffer = (globalThis as unknown as {
      Buffer?: { from(input: string, encoding: string): { toString(enc: string): string } };
    }).Buffer;
    if (!maybeBuffer) return null;
    const text = maybeBuffer.from(padded, "base64").toString("utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenMatchesCurrentProject(accessToken: string): boolean {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return false;

  const iss = String(payload.iss || "").toLowerCase();
  const expectedHost = String(ENV.supabaseUrl || "").toLowerCase().replace(/\/+$/, "");
  if (!iss || !expectedHost) return false;
  if (!iss.includes(expectedHost)) return false;

  const exp = Number(payload.exp || 0);
  if (!exp) return false;
  return exp * 1000 > Date.now() + 15_000;
}

function readStorage(): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(ADMIN_SESSION_KEY);
    }
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStorage(value: string | null): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (value === null) window.localStorage.removeItem(ADMIN_SESSION_KEY);
      else window.localStorage.setItem(ADMIN_SESSION_KEY, value);
      return;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (value === null) window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      else window.sessionStorage.setItem(ADMIN_SESSION_KEY, value);
    }
  } catch {
    // ignore
  }
}

export function saveStoredAdminSession(session: Session | null | undefined): void {
  const accessToken = String(session?.access_token || "").trim();
  const refreshToken = String(session?.refresh_token || "").trim();
  const expiresAt = Number(session?.expires_at || 0);
  const userEmail = String(session?.user?.email || "").trim().toLowerCase();
  if (!accessToken || !refreshToken || !expiresAt) return;
  const payload: StoredAdminSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user_email: userEmail,
  };
  writeStorage(JSON.stringify(payload));
}

export function clearStoredAdminSession(): void {
  writeStorage(null);
}

export function getStoredAdminSession(): StoredAdminSession | null {
  const raw = readStorage();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    const accessToken = String(parsed.access_token || "").trim();
    const refreshToken = String(parsed.refresh_token || "").trim();
    const expiresAt = Number(parsed.expires_at || 0);
    const userEmail = String(parsed.user_email || "").trim().toLowerCase();
    if (!accessToken || !refreshToken || !expiresAt) {
      writeStorage(null);
      return null;
    }
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      user_email: userEmail,
    };
  } catch {
    writeStorage(null);
    return null;
  }
}

export function isStoredAdminSessionValid(value: StoredAdminSession | null | undefined): boolean {
  if (!value?.access_token || !value.refresh_token) return false;
  const expiresAtMs = Number(value.expires_at || 0) * 1000;
  if (!expiresAtMs) return false;
  if (expiresAtMs <= Date.now() + 15_000) return false;
  return tokenMatchesCurrentProject(value.access_token);
}
