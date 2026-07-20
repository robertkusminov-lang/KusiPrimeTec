import React from "react";

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(_error: Error): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error) {
    console.error("AppErrorBoundary", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="narrow-frame mt-10">
          <div className="glass page-card rounded-xl2 border border-rose-400/40">
            <h1 className="section-heading text-rose-200">Anzeigefehler im Frontend</h1>
            <p className="section-subtitle mt-2">
              Die Seite konnte nicht vollständig gerendert werden. Bitte Seite neu laden oder neu anmelden.
            </p>
            <p className="mt-3 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              Ein Fehler ist aufgetreten.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
