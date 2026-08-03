import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

describe("Supabase security guardrails", () => {
  it("keeps JWT verification configuration explicit per Edge Function", () => {
    const config = readFileSync(repoFile("api/supabase.toml"), "utf8");
    const functionRoot = repoFile("api/supabase/functions");
    const functionNames = readdirSync(functionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
      .map((entry) => entry.name);

    expect(config).not.toMatch(/^\[functions\]\s*$/m);
    for (const functionName of functionNames) {
      expect(config).toContain(`[functions.${functionName}]`);
    }

    const deployScript = readFileSync(repoFile("scripts/deploy-supabase-functions.ps1"), "utf8");
    expect(deployScript).not.toContain("--no-verify-jwt");
  });

  it("blocks the legacy admin escalation and enables RLS on operational tables", () => {
    const migration = readFileSync(
      repoFile("api/supabase/migrations/20260803143000_harden_supabase_access_and_indexes.sql"),
      "utf8",
    );

    expect(migration).toContain('drop policy if exists "Enable insert for authenticated users only"');
    expect(migration).toContain("drop policy if exists customer_select_own_tickets");
    expect(migration).toContain("drop policy if exists tickets_public_insert_inbox");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("security_invoker = true");
    expect(migration).toContain("revoke all on table public.%I from anon");
  });
});
