import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSeo } from "@/hooks/useSeo";
import { toUserMessage } from "@/lib/errors";

export default function CustomerAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useSeo({
    title: "Kundenlogin - KusiPrimeTec",
    description: "Anmeldung für bestehende Kunden mit freigeschaltetem Kundenkonto und zugewiesenen Objekten.",
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session?.access_token));
      setSessionReady(true);
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password.trim()) {
        setError("E-Mail und Passwort sind erforderlich.");
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginError) throw loginError;
      const target = String((location.state as { from?: string } | null)?.from || "/konto");
      navigate(target, { replace: true });
    } catch (err) {
      setError(toUserMessage(err, "Anmeldung fehlgeschlagen."));
    } finally {
      setLoading(false);
    }
  }

  if (sessionReady && hasSession) return <Navigate to="/konto" replace />;

  return (
    <div className="narrow-frame page-enter">
      <section className="premium-card page-card-lg">
        <h1 className="section-heading text-white">Kundenlogin</h1>
        <p className="section-subtitle mt-2">
          Dieser Zugang ist für bestehende Kunden mit freigeschaltetem Kundenkonto gedacht.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Zugangsdaten werden durch Robert Kusminov bzw. den Admin vergeben. Eine öffentliche Selbstregistrierung ist nicht vorgesehen.
        </p>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Passwort" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button disabled={loading} className="btn-primary-premium rounded-xl px-4 py-2 text-sm font-semibold">
            {loading ? "Bitte warten..." : "Einloggen"}
          </button>
        </form>
      </section>
    </div>
  );
}
