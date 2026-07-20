import { BookingWizard } from "@/features/booking/BookingWizard";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BUSINESS_RULES } from "@/config/businessRules";
import {
  LEISTUNGSUMFANG_ERLAUBT,
  LEISTUNGSUMFANG_HINWEIS,
  LEISTUNGSUMFANG_NICHT,
} from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/lib/supabase";

export default function EinzelauftragPage() {
  const initialAnfrageart = "direkt_einsatz";
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [profilePrefill, setProfilePrefill] = useState<Record<string, string>>({});
  const [objectOptions, setObjectOptions] = useState<
    Array<{ id: string; name: string; street?: string; zip?: string; city?: string; access_notes?: string }>
  >([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setHasSession(Boolean(session?.access_token));
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("customers")
          .select("name,company_name,phone,city,zip,contact_person")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        if (profile) {
          setProfilePrefill({
            kunde_name: String(profile.name || ""),
            kunde_firma: String(profile.company_name || ""),
            kunde_telefon: String(profile.phone || ""),
            ort: String(profile.city || ""),
            plz: String(profile.zip || ""),
            ansprechpartner: String(profile.contact_person || profile.name || ""),
            kunde_email: String(session.user.email || ""),
          });
        } else {
          setProfilePrefill({ kunde_email: String(session.user.email || "") });
        }

        const { data: objects } = await supabase
          .from("objects")
          .select("id,name,street,zip,city,access_notes,is_active")
          .eq("requester_user_id", session.user.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false });
        setObjectOptions(
          (objects || []).map((row) => ({
            id: String(row.id || ""),
            name: String(row.name || "Objekt"),
            street: String(row.street || ""),
            zip: String(row.zip || ""),
            city: String(row.city || ""),
            access_notes: String(row.access_notes || ""),
          })),
        );
      }
      setReady(true);
    })();
  }, []);

  useSeo({
    title: "Einzelauftrag anfragen | KusiPrimeTec",
    description: `Öffentliche Anfrage für Einzelaufträge, Kleinreparaturen und Störungsaufnahme im Raum Schorndorf (${BUSINESS_RULES.serviceArea.radiusKm} km).`,
  });

  return (
    <div className="page-enter page-stack">
      <header className="premium-card page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Einzelauftrag</p>
        <h1 className="public-page-title mt-2 text-white">Einzelauftrag anfragen</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Für einmalige Einsätze, Kleinreparaturen, Mängelaufnahme, Terminabstimmung und Rückfragen im Bestand.
        </p>
      </header>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Hinweis zum Leistungsumfang</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{LEISTUNGSUMFANG_HINWEIS}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-300/30 bg-emerald-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Das übernehmen wir</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_ERLAUBT.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-rose-300/30 bg-rose-400/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">Nicht im direkten Leistungsumfang</p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-main)]">
              {LEISTUNGSUMFANG_NICHT.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {!ready ? (
        <section className="premium-card page-card text-sm text-[var(--text-soft)]">Konto-Status wird geprüft...</section>
      ) : hasSession ? (
        <section className="premium-card page-card">
          <p className="text-sm text-[var(--text-soft)]">
            Ihr Kundenkonto ist erkannt. Zugewiesene Objekte können direkt im Formular vorausgewählt werden.
            <Link to="/konto" className="ml-2 text-electric-200 underline underline-offset-4">
              Zum Kundenportal
            </Link>
          </p>
        </section>
      ) : (
        <section className="premium-card page-card">
          <p className="text-sm text-[var(--text-soft)]">
            Öffentliche Anfragen sind weiterhin möglich. Für laufende Objektzuordnungen und Ticketübersichten nutzen bestehende Kunden bitte den
            <Link to="/konto/anmelden" className="ml-2 text-electric-200 underline underline-offset-4">
              Kundenlogin
            </Link>
            .
          </p>
        </section>
      )}

      <section className="premium-card overflow-hidden p-0">
        <BookingWizard
          initialAnfrageart={initialAnfrageart}
          profilePrefill={profilePrefill}
          objectOptions={objectOptions}
        />
      </section>
    </div>
  );
}
