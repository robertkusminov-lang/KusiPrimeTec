import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page-enter rounded-xl2 border border-[var(--line)] bg-slate-950/40 p-8 text-center">
      <h1 className="font-['Sora'] text-3xl font-bold">Seite nicht gefunden</h1>
      <p className="mt-2 text-sm text-[var(--text-soft)]">Bitte prüfen Sie die URL oder kehren Sie zur Startseite zurück.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link className="btn-primary-premium" to="/">Zur Startseite</Link>
        <Link className="btn-secondary-premium" to="/leistungen">Leistungen ansehen</Link>
        <Link className="btn-secondary-premium" to="/objektcheck">ObjektCheck starten</Link>
      </div>
    </div>
  );
}


