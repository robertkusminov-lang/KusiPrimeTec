import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import "./styles/globals.css";

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) return;

  if (root.dataset.prerendered === "true") {
    root.replaceChildren();
    root.removeAttribute("data-prerendered");
  }

  try {
    const { default: App } = await import("./App");
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AppErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("App bootstrap failed", error);
    root.innerHTML = `
      <div style="max-width:820px;margin:40px auto;padding:0 16px;font-family:Manrope,Segoe UI,sans-serif;color:#e7eef9;">
        <div style="border:1px solid rgba(255,143,161,.45);background:rgba(40,18,26,.45);border-radius:16px;padding:18px;">
          <h1 style="margin:0 0 10px 0;font-size:24px;">Frontend konnte nicht starten</h1>
          <p style="margin:0;color:#a6bdd5;">Bitte Seite neu laden. Wenn der Fehler bleibt, erneut anmelden oder Support kontaktieren.</p>
        </div>
      </div>
    `;
  }
}

void bootstrap();


