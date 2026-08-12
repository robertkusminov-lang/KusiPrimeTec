import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  evaluateObjectCheck,
  OBJECT_CHECK_AREA_LABELS,
  OBJECT_CHECK_QUESTIONS,
  type ObjectCheckAnswers,
  type ObjectCheckArea,
  type ObjectCheckResult,
} from "@/features/objectCheck/objectCheck";
import { trackObjectCheckEvent } from "@/lib/objectCheckAnalytics";
import { useSeo } from "@/hooks/useSeo";

const DISCLAIMER =
  "Der digitale ObjektCheck ist eine unverbindliche organisatorische Ersteinschätzung auf Grundlage Ihrer Angaben. Er ersetzt keine technische Prüfung, Sicherheitsprüfung, Gefährdungsbeurteilung, Sachverständigenleistung oder gesetzlich vorgeschriebene Prüfung.";

const CATEGORY_COPY: Record<ObjectCheckResult["category"], string> = {
  "Strukturiert betreut": "Ihre Angaben sprechen für bereits gut nachvollziehbare organisatorische Abläufe.",
  "Punktueller Optimierungsbedarf": "Die Grundstruktur ist vorhanden. Einzelne Abläufe können noch klarer gebündelt werden.",
  "Erhöhter Betreuungsbedarf": "Mehrere Bereiche profitieren von festen Zuständigkeiten und einer einheitlichen Dokumentation.",
  "Strukturaufbau empfohlen": "Ein schrittweiser Aufbau zentraler Abläufe kann den täglichen Umgang mit offenen Objektthemen deutlich vereinfachen.",
};

const INFORMATION_SECTIONS = [
  {
    title: "Für wen ist der ObjektCheck gedacht?",
    text: "Für Unternehmen, Verwaltungen und Eigentümer, die Büro-, Praxis-, Handels-, Gewerbe-, Wohn- oder Mischobjekte im Raum Schorndorf und Remstal organisatorisch betreuen.",
  },
  {
    title: "Welche Bereiche werden betrachtet?",
    text: "Der Check betrachtet Kontrollrhythmus, Mängeldokumentation, Reaktion auf Störungen, Vertretung und die organisatorische Koordination externer Fachfirmen.",
  },
  {
    title: "So funktioniert der Check",
    text: "Sie beantworten acht kurze Fragen. Daraus wird direkt im Browser eine verständliche organisatorische Einordnung mit drei praktischen Empfehlungen erstellt.",
  },
  {
    title: "Beispiel eines anonymisierten Ergebnisses",
    text: "Beispiel: Punktueller Optimierungsbedarf. Empfohlen werden eine zentrale Mängelliste, ein fester Kontrollrhythmus und eine dokumentierte Vertretungsregelung.",
  },
  {
    title: "Was passiert mit meinen Antworten?",
    text: "Die Antworten bleiben während des Checks im Arbeitsspeicher Ihres Browsers. Vor einer freiwilligen Kontaktaktion werden sie weder an einen Server noch an das Ticketsystem gesendet.",
  },
  {
    title: "Objektbetreuung im Raum Schorndorf und Remstal",
    text: "KusiPrimeTec unterstützt Bestandsobjekte ungefähr 30 Kilometer um Schorndorf mit Objektkontrollen, Mängeldokumentation, zulässigen Kleinreparaturen und organisatorischer Fachfirmenkoordination.",
  },
];

function AreaDisplay({ area, score }: { area: ObjectCheckArea; score: number }) {
  const level = score <= 1 ? "Gut organisiert" : score <= 2 ? "Punktuell klären" : "Struktur aufbauen";
  return (
    <div className="object-check-area">
      <div><strong>{OBJECT_CHECK_AREA_LABELS[area]}</strong><span>{level}</span></div>
      <div className="object-check-area-scale" aria-label={`${OBJECT_CHECK_AREA_LABELS[area]}: ${level}`}>
        {[1, 2, 3, 4].map((item) => <span key={item} className={item <= score ? "is-active" : ""} />)}
      </div>
    </div>
  );
}

export default function ObjectCheckPage() {
  useSeo({
    title: "Kostenloser ObjektCheck für Gewerbeimmobilien im Remstal | KusiPrimeTec",
    description: "In 2 Minuten erkennen, wie gut Kontrolle, Mängelmanagement, Vertretung und technische Objektbetreuung organisiert sind. Sofortergebnis ohne Anmeldung.",
    canonicalPath: "/objektcheck",
  });

  const navigate = useNavigate();
  const [started, setStarted] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<ObjectCheckAnswers>({});
  const [validationMessage, setValidationMessage] = React.useState("");
  const [result, setResult] = React.useState<ObjectCheckResult | null>(null);
  const [noContactMessage, setNoContactMessage] = React.useState(false);
  const questionHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const resultRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    trackObjectCheckEvent("object_check_view");
  }, []);

  React.useEffect(() => {
    if (started && !result) questionHeadingRef.current?.focus();
  }, [result, started, step]);

  const question = OBJECT_CHECK_QUESTIONS[step];
  const progress = Math.round(((step + 1) / OBJECT_CHECK_QUESTIONS.length) * 100);

  function startCheck() {
    setStarted(true);
    setResult(null);
    setStep(0);
    setAnswers({});
    setValidationMessage("");
    setNoContactMessage(false);
    trackObjectCheckEvent("object_check_start", { question_count: OBJECT_CHECK_QUESTIONS.length });
  }

  function selectAnswer(value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    setValidationMessage("");
  }

  function continueCheck() {
    if (!answers[question.id]) {
      setValidationMessage("Bitte wählen Sie eine Antwort aus, bevor Sie fortfahren.");
      return;
    }

    trackObjectCheckEvent("object_check_step", { step_number: step + 1, question_count: OBJECT_CHECK_QUESTIONS.length });
    if (step < OBJECT_CHECK_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const evaluated = evaluateObjectCheck(answers);
    setResult(evaluated);
    trackObjectCheckEvent("object_check_complete", { question_count: OBJECT_CHECK_QUESTIONS.length });
    trackObjectCheckEvent("object_check_result_category", { result_category: evaluated.category });
    window.setTimeout(() => resultRef.current?.focus(), 0);
  }

  function printResult() {
    trackObjectCheckEvent("object_check_cta_click", { cta_type: "print", result_category: result?.category });
    window.print();
  }

  function requestObjectCare() {
    trackObjectCheckEvent("object_check_cta_click", { cta_type: "object_care", result_category: result?.category });
    trackObjectCheckEvent("object_check_lead_handoff", { cta_type: "object_care", result_category: result?.category });
    navigate("/objektbetreuung-anfrage");
  }

  function declineContact() {
    trackObjectCheckEvent("object_check_cta_click", { cta_type: "no_contact", result_category: result?.category });
    setNoContactMessage(true);
  }

  return (
    <div className="object-check-page page-enter page-stack-large">
      <header className="object-check-hero premium-card premium-card-strong page-card-hero">
        <div className="object-check-hero-copy">
          <p className="object-check-kicker">Kostenlose organisatorische Ersteinschätzung</p>
          <h1>Wie gut ist Ihr Objekt im Alltag betreut?</h1>
          <p className="object-check-lead">Acht kurze Fragen zeigen, wie klar Kontrollen, Mängel, Vertretung und Fachfirmenkoordination im Alltag organisiert sind.</p>
          <ul className="object-check-benefits" aria-label="Vorteile des ObjektChecks">
            <li>Kostenlos und unverbindlich</li>
            <li>Ungefähr zwei Minuten</li>
            <li>Sofortergebnis</li>
            <li>Keine Anmeldung</li>
          </ul>
          <p className="object-check-audience">Für Unternehmen, Verwaltungen und Eigentümer im Remstal.</p>
          {!started ? <button type="button" className="btn-primary-premium object-check-start" onClick={startCheck}>Kostenlosen ObjektCheck starten</button> : null}
        </div>
        <div className="object-check-hero-mark" aria-hidden="true"><span>8</span><small>Fragen</small></div>
      </header>

      {started && !result ? (
        <section className="object-check-wizard premium-card" aria-labelledby="object-check-question">
          <div className="object-check-progress-head">
            <span>Frage {step + 1} von {OBJECT_CHECK_QUESTIONS.length}</span>
            <span>{progress} %</span>
          </div>
          <div className="object-check-progress" role="progressbar" aria-valuemin={1} aria-valuemax={OBJECT_CHECK_QUESTIONS.length} aria-valuenow={step + 1} aria-valuetext={`Frage ${step + 1} von ${OBJECT_CHECK_QUESTIONS.length}`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <fieldset className="object-check-fieldset">
            <legend className="sr-only">{question.title}</legend>
            <p className="object-check-step-label">Organisatorischer ObjektCheck</p>
            <h2 id="object-check-question" ref={questionHeadingRef} tabIndex={-1}>{question.title}</h2>
            <p>{question.hint}</p>
            <div className="object-check-options">
              {question.options.map((option) => (
                <label key={option.value} className={answers[question.id] === option.value ? "is-selected" : ""}>
                  <input type="radio" name={question.id} value={option.value} checked={answers[question.id] === option.value} onChange={() => selectAnswer(option.value)} />
                  <span aria-hidden="true" />
                  <strong>{option.label}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="object-check-error" role="alert" aria-live="assertive">{validationMessage}</p>
          <div className="object-check-actions">
            <button type="button" className="btn-secondary-premium" disabled={step === 0} onClick={() => { setValidationMessage(""); setStep((current) => Math.max(0, current - 1)); }}>Zurück</button>
            <button type="button" className="btn-primary-premium" onClick={continueCheck}>{step === OBJECT_CHECK_QUESTIONS.length - 1 ? "Ergebnis anzeigen" : "Weiter"}</button>
          </div>
        </section>
      ) : null}

      {result ? (
        <section ref={resultRef} tabIndex={-1} className="object-check-result premium-card premium-card-strong" aria-labelledby="object-check-result-heading" aria-live="polite">
          <div className="object-check-result-head">
            <p className="object-check-kicker">Ihr Sofortergebnis</p>
            <h2 id="object-check-result-heading">{result.category}</h2>
            <p>{CATEGORY_COPY[result.category]}</p>
          </div>

          <div className="object-check-area-grid">
            {(Object.keys(result.areas) as ObjectCheckArea[]).map((area) => <AreaDisplay key={area} area={area} score={result.areas[area]} />)}
          </div>

          <div className="object-check-recommendations">
            <h3>Drei sinnvolle nächste Schritte</h3>
            <ol>{result.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ol>
            <p>{result.nextStep}</p>
          </div>

          <p className="object-check-disclaimer">{DISCLAIMER}</p>
          <div className="object-check-result-actions">
            <button type="button" className="btn-secondary-premium" onClick={printResult}>Ergebnis drucken oder als PDF speichern</button>
            <button type="button" className="btn-primary-premium" onClick={requestObjectCare}>Unverbindliche Objektbetreuung anfragen</button>
            <button type="button" className="object-check-no-contact" onClick={declineContact}>Vorerst keine Kontaktaufnahme</button>
          </div>
          {noContactMessage ? <p className="object-check-confirmation" role="status">Es erfolgt keine Kontaktaufnahme. Ihr Ergebnis bleibt vollständig sichtbar.</p> : null}
          <button type="button" className="object-check-restart" onClick={startCheck}>ObjektCheck neu starten</button>
        </section>
      ) : null}

      <section className="object-check-information" aria-label="Informationen zum ObjektCheck">
        {INFORMATION_SECTIONS.map((section) => (
          <article key={section.title} className="premium-card page-card">
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>

      <section className="premium-card page-card object-check-faq">
        <p className="object-check-kicker">Häufig gestellte Fragen</p>
        <h2>Fragen zum digitalen ObjektCheck</h2>
        <details><summary>Ist das Ergebnis eine technische Prüfung?</summary><p>Nein. Es ist ausschließlich eine organisatorische Ersteinschätzung anhand Ihrer Angaben.</p></details>
        <details><summary>Muss ich Kontaktdaten angeben?</summary><p>Nein. Der vollständige Check und das Ergebnis funktionieren ohne Anmeldung und ohne Kontaktdaten.</p></details>
        <details><summary>Werden meine Antworten gespeichert?</summary><p>Nein. Die Antworten werden nur für den aktuellen Durchlauf im Arbeitsspeicher des Browsers gehalten.</p></details>
        <details><summary>Kann ich das Ergebnis aufbewahren?</summary><p>Ja. Nutzen Sie nach dem Check die Druckfunktion Ihres Browsers und wählen Sie dort bei Bedarf „Als PDF speichern“.</p></details>
      </section>

      <section className="premium-card page-card object-check-legal">
        <h2>Rechtliche Abgrenzung</h2>
        <p>{DISCLAIMER}</p>
      </section>

      <section className="premium-card premium-card-strong page-card-lg text-center object-check-final-cta">
        <p className="object-check-kicker">In ungefähr zwei Minuten</p>
        <h2>Organisatorische Betreuung jetzt einordnen</h2>
        <p>Ohne Anmeldung, ohne Kontaktdaten und mit einem sofort sichtbaren Ergebnis.</p>
        <button type="button" className="btn-primary-premium" onClick={startCheck}>Kostenlosen ObjektCheck starten</button>
        <NavLink to="/leistungen">Leistungen von KusiPrimeTec ansehen</NavLink>
      </section>
    </div>
  );
}
