import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("professional admin dashboard", () => {
  const dashboard = source("../../app/src/pages/admin/AdminDashboardPage.tsx");
  const styles = source("../../app/src/styles/globals.css");

  it("surfaces operational priorities with links to filtered ticket views", () => {
    expect(dashboard).toContain("Was jetzt Aufmerksamkeit braucht");
    expect(dashboard).toContain('urgency: "hoch_notfall"');
    expect(dashboard).toContain('due_today: "1"');
    expect(dashboard).toContain('without_schedule: "1"');
    expect(dashboard).toContain("Neue Eingänge");
  });

  it("shows customer, object, urgency, status and appointment without prompt actions", () => {
    expect(dashboard).toContain("Kunde / Objekt");
    expect(dashboard).toContain("Priorität");
    expect(dashboard).toContain("<StatusChip");
    expect(dashboard).toContain("<RequestTypeBadge");
    expect(dashboard).toContain("Nicht terminiert");
    expect(dashboard).not.toContain("window.prompt");
  });

  it("keeps the dashboard responsive without horizontal viewport workarounds", () => {
    expect(styles).toContain(".dashboard-workspace");
    expect(styles).toContain("@media (max-width: 639px)");
    expect(styles).toContain(".dashboard-ticket-row");
    expect(styles).not.toMatch(/\.dashboard-[^{]+\{[^}]*width:\s*100vw/s);
  });
});
