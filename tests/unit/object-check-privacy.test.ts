import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("ObjektCheck privacy and delivery", () => {
  it("keeps answers in browser memory and sends no check data to an API", () => {
    const page = source("../../app/src/pages/public/ObjectCheckPage.tsx");

    expect(page).not.toMatch(/\bfetch\s*\(/);
    expect(page).not.toContain("supabase");
    expect(page).not.toContain("localStorage");
    expect(page).not.toContain("sessionStorage");
    expect(page).not.toContain("<form");
    expect(page).toContain("window.print()");
  });

  it("limits analytics to consent-aware technical event fields", () => {
    const analytics = source("../../app/src/lib/objectCheckAnalytics.ts");

    expect(analytics).toContain('getAnalyticsConsent() !== "granted"');
    expect(analytics).toContain("step_number");
    expect(analytics).toContain("result_category");
    expect(analytics).not.toMatch(/\b(email|telefon|phone|address|answer|answers)\??:/i);
  });

  it("contains the required disclaimer and all eight questions", () => {
    const page = source("../../app/src/pages/public/ObjectCheckPage.tsx");
    const scoring = source("../../app/src/features/objectCheck/objectCheck.ts");

    expect(page).toContain("Er ersetzt keine technische");
    expect(page).toContain("Sicherheitspr");
    expect(scoring.match(/\bid:\s*"[a-z_]+"/g)).toHaveLength(8);
  });
});
