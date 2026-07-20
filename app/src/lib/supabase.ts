import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

const fallbackUrl = "http://127.0.0.1:54321";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem(key: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    memoryStorage.set(key, value);
  },
  removeItem(key: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Browser blockiert Storage-Zugriff.
    }
    memoryStorage.delete(key);
  },
};

export const HAS_SUPABASE_PUBLIC_CONFIG = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);

export const supabase = createClient(HAS_SUPABASE_PUBLIC_CONFIG ? ENV.supabaseUrl : fallbackUrl, HAS_SUPABASE_PUBLIC_CONFIG ? ENV.supabaseAnonKey : fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: safeStorage,
  },
});


