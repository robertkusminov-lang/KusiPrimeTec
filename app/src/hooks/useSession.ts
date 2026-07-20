import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { saveStoredAdminSession } from "@/lib/adminAuth";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const setSessionSafe = (next: Session | null) => {
      sessionRef.current = next;
      setSession(next);
      if (next?.access_token) saveStoredAdminSession(next);
    };

    const hasAccessToken = (candidate: Session | null): boolean => {
      return Boolean(candidate?.access_token);
    };

    const expiresSoon = (candidate: Session | null): boolean => {
      if (!candidate?.access_token) return false;
      const expiresAtMs = Number(candidate.expires_at || 0) * 1000;
      if (!expiresAtMs) return false;
      return expiresAtMs <= Date.now() + 60_000;
    };

    const recoverSession = async (): Promise<Session | null> => {
      const current = await supabase.auth.getSession();
      const currentSession = current.data.session;
      if (!current.error && hasAccessToken(currentSession)) {
        return currentSession;
      }

      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && hasAccessToken(refreshed.data.session)) {
        return refreshed.data.session;
      }

      return null;
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const recoverSessionWithRetries = async (attempts: number, waitMs: number): Promise<Session | null> => {
      for (let i = 0; i < attempts; i += 1) {
        const recovered = await recoverSession();
        if (hasAccessToken(recovered)) return recovered;
        if (i < attempts - 1) await delay(waitMs);
      }
      return null;
    };

    const validateAndSet = async (candidate: Session | null) => {
      if (hasAccessToken(candidate)) {
        setSessionSafe(candidate);
        if (expiresSoon(candidate)) {
          void (async () => {
            const recoveredSoon = await recoverSession();
            if (hasAccessToken(recoveredSoon)) setSessionSafe(recoveredSoon);
          })();
        }
        return;
      }

      const recovered = await recoverSessionWithRetries(2, 120);
      if (hasAccessToken(recovered)) {
        setSessionSafe(recovered);
        return;
      }

      const previous = sessionRef.current;
      if (hasAccessToken(previous)) {
        // Keep prior session for transient auth-state races.
        setSessionSafe(previous);
        return;
      }

      // Beim Redirect nach Login kann das Session-Persisting laenger nachlaufen.
      const recoveredAfterDelay = await recoverSessionWithRetries(8, 250);
      if (hasAccessToken(recoveredAfterDelay)) {
        setSessionSafe(recoveredAfterDelay);
        return;
      }

      setSessionSafe(null);
    };

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        await validateAndSet(data.session);
      })
      .catch(() => {
        setSessionSafe(null);
      })
      .finally(() => {
        setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void (async () => {
        if (event === "SIGNED_OUT") {
          setSessionSafe(null);
          setReady(true);
          return;
        }

        await validateAndSet(nextSession);
        setReady(true);
      })();
    });

    const refreshInterval = window.setInterval(() => {
      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const current = data.session;
          if (!current?.access_token) return;
          const expiresAtMs = Number(current.expires_at || 0) * 1000;
          if (expiresAtMs && expiresAtMs > Date.now() + 90_000) {
            saveStoredAdminSession(current);
            return;
          }
          const refreshed = await supabase.auth.refreshSession();
          if (!refreshed.error && refreshed.data.session?.access_token) {
            setSessionSafe(refreshed.data.session);
          }
        } catch {
          // keep current UI state and retry next interval
        }
      })();
    }, 45_000);

    return () => {
      window.clearInterval(refreshInterval);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready };
}
