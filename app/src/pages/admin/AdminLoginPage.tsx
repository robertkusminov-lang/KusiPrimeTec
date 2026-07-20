import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Toast } from "@/components/ui/Toast";
import { apiGet } from "@/lib/api";
import { clearStoredAdminSession, saveStoredAdminSession } from "@/lib/adminAuth";
import { toUserMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpiredFromRoute = (location.state as { reason?: string } | null)?.reason === "expired";
  const [showSessionExpired, setShowSessionExpired] = React.useState(sessionExpiredFromRoute);

  React.useEffect(() => {
    setShowSessionExpired(sessionExpiredFromRoute);
    if (sessionExpiredFromRoute) {
      clearStoredAdminSession();
    }
  }, [sessionExpiredFromRoute]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setShowSessionExpired(false);
    setInfo("");
    if (!normalizedEmail || !password) {
      setError("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.");
      return;
    }
    clearStoredAdminSession();
    try {
      await supabase.auth.signOut();
    } catch {
      // Bei abgelaufener/fehlender Session ignorieren.
    }
    setLoading(true);
    setError("");
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setLoading(false);
    if (loginError) {
      setError("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.");
      return;
    }
    let hasSession = Boolean(loginData.session?.access_token);
    for (let i = 0; i < 5 && !hasSession; i += 1) {
      const { data } = await supabase.auth.getSession();
      hasSession = Boolean(data.session?.access_token);
      if (!hasSession) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    }
    if (!hasSession) {
      setError("Sitzung konnte nicht aufgebaut werden. Bitte erneut anmelden.");
      return;
    }
    const { data: currentSessionData } = await supabase.auth.getSession();
    const accessToken = currentSessionData.session?.access_token || loginData.session?.access_token || "";
    if (!accessToken) {
      setError("Sitzung konnte nicht aufgebaut werden. Bitte erneut anmelden.");
      return;
    }
    saveStoredAdminSession(currentSessionData.session || loginData.session);
    try {
      await apiGet<{ ok: boolean; email: string }>("admin-whoami", accessToken);
    } catch (err) {
      clearStoredAdminSession();
      await supabase.auth.signOut();
      setError(toUserMessage(err, "Kein Admin-Zugriff. Bitte Zugang prüfen."));
      return;
    }
    navigate("/admin", { replace: true });
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    setShowSessionExpired(false);
    setError("");
    setInfo("");
    if (!normalizedEmail) {
      setError("Bitte zuerst eine E-Mail eingeben.");
      return;
    }

    setResetLoading(true);
    const redirectTo = `${window.location.origin}/admin/login`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    setResetLoading(false);
    if (resetError) {
      setError("Reset-Link konnte nicht gesendet werden. Bitte später erneut versuchen.");
      return;
    }
    setInfo("Reset-Link wurde versendet. Bitte E-Mail-Postfach prüfen.");
  }

  return (
    <div className="admin-ui narrow-frame mt-12 page-enter">
      <GlassCard className="page-card">
        <h1 className="section-heading text-white">Admin Login</h1>
        <p className="section-subtitle mt-1">Geschützter Zugriff für berechtigte Administratoren.</p>
        <form className="mt-4 grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-sm">
            <span>E-Mail</span>
            <input
              type="email"
              required
              className="premium-input px-3 py-2"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (showSessionExpired) setShowSessionExpired(false);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Passwort</span>
            <input
              type="password"
              required
              className="premium-input px-3 py-2"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (showSessionExpired) setShowSessionExpired(false);
              }}
            />
          </label>
          {showSessionExpired ? <Toast kind="error" text="Sitzung abgelaufen. Bitte erneut anmelden." /> : null}
          {info ? <Toast kind="ok" text={info} /> : null}
          {error ? <Toast kind="error" text={error} /> : null}
          <Button type="submit" disabled={loading}>{loading ? "Anmeldung läuft..." : "Anmelden"}</Button>
          <Button type="button" variant="secondary" disabled={resetLoading} onClick={() => void requestPasswordReset()}>
            {resetLoading ? "Reset-Link wird gesendet..." : "Passwort zurücksetzen"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
