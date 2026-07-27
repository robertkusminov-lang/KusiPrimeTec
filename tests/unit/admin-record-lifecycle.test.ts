import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("admin record lifecycle guardrails", () => {
  it("routes ticket and customer deletion through the authenticated admin function", () => {
    const apiClient = source("../../app/src/features/apiClient.ts");
    const directDeletePattern = /from\("tickets"\)\s*\.delete/;

    expect(apiClient).not.toMatch(directDeletePattern);
    expect(apiClient).toContain('action: "delete_ticket"');
    expect(apiClient).toContain('action: "delete_customer"');
    expect(apiClient).toContain('"admin-object-actions"');
  });

  it("checks destructive dependencies and never detaches object tickets before deletion", () => {
    const adminActions = source("../../api/supabase/functions/admin-object-actions/index.ts");

    expect(adminActions.indexOf("await requireAdmin(req)")).toBeLessThan(
      adminActions.indexOf('if (action === "delete_object")'),
    );
    expect(adminActions).toContain("dependency_counts");
    expect(adminActions).toContain("Bitte archiviere den Kunden stattdessen.");
    expect(adminActions).toContain("Bitte deaktiviere das Objekt stattdessen.");
    expect(adminActions).not.toContain('.update({ object_id: null }).eq("object_id", objectId)');
  });

  it("keeps the customer lifecycle migration additive and rollback-safe", () => {
    const migration = source(
      "../../api/supabase/migrations/20260723143000_customer_lifecycle_status.sql",
    );

    expect(migration).toContain("add column if not exists status");
    expect(migration).toContain("add column if not exists archived_at");
    expect(migration).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("uses a shared accessible dialog and prevents repeated destructive clicks", () => {
    const dialog = source("../../app/src/components/ui/ConfirmDialog.tsx");
    const customerPage = source("../../app/src/pages/admin/AdminCustomersPage.tsx");

    expect(dialog).toContain('role="alertdialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("Diese Aktion kann nicht rückgängig gemacht werden.");
    expect(dialog).toContain("disabled={busy}");
    expect(customerPage).not.toContain("deleteCustomerTickets");
    expect(customerPage).not.toContain("window.prompt");
  });
});
