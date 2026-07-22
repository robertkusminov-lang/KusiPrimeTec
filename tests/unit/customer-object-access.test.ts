import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canCustomerAccessTicket,
  isObjectAssignableToCustomer,
  isObjectOwnedByCustomer,
  isTicketObjectConsistent,
  selectUniqueCustomerObject,
} from "../../api/supabase/functions/_shared/customer-object-access";

const customerA = "customer-a";
const customerB = "customer-b";
const userA = "user-a";
const userB = "user-b";

function object(id: string, customerId: string, userId: string, active = true) {
  return { id, customer_id: customerId, requester_user_id: userId, is_active: active };
}

describe("customer object access security", () => {
  it("never selects customer A's object for customer B at the same address", () => {
    const result = selectUniqueCustomerObject(
      [object("object-a", customerA, userA), object("object-b", customerB, userB)],
      customerB,
      userB,
    );
    expect(result).toEqual({ object: object("object-b", customerB, userB), ambiguous: false });
  });

  it("denies a known ticket or report id owned by another customer", () => {
    const ticketB = { object_id: "object-b", customer_id: customerB, requester_user_id: userB };
    expect(canCustomerAccessTicket(ticketB, object("object-b", customerB, userB), customerA, userA)).toBe(false);
  });

  it("removes access as soon as an object is inactive", () => {
    const ticketA = { object_id: "object-a", customer_id: customerA, requester_user_id: userA };
    expect(canCustomerAccessTicket(ticketA, object("object-a", customerA, userA, false), customerA, userA)).toBe(false);
  });

  it("allows an unclaimed object of the exact customer to be linked safely", () => {
    const unclaimedObject = {
      id: "object-a",
      customer_id: customerA,
      requester_user_id: null,
      is_active: true,
    };

    expect(isObjectAssignableToCustomer(unclaimedObject, customerA, userA)).toBe(true);
    expect(isObjectOwnedByCustomer(unclaimedObject, customerA, userA)).toBe(false);
    expect(isObjectAssignableToCustomer(unclaimedObject, customerB, userB)).toBe(false);
  });

  it("keeps the existing admin policies while hardening customer policies", () => {
    const migrationPath = fileURLToPath(
      new URL("../../api/supabase/migrations/20260722190000_harden_customer_object_access.sql", import.meta.url),
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toContain("drop policy if exists tickets_admin_all");
    expect(sql).not.toContain("drop policy if exists objects_admin_all");
    expect(sql).toContain("o.is_active = true");
  });

  it("rejects a client supplied object from another customer", () => {
    expect(isObjectOwnedByCustomer(object("object-a", customerA, userA), customerB, userB)).toBe(false);
    expect(
      isTicketObjectConsistent(
        { object_id: "object-a", customer_id: customerB, requester_user_id: userB },
        object("object-a", customerA, userA),
      ),
    ).toBe(false);
  });

  it("rejects ambiguous objects even for the same customer", () => {
    const result = selectUniqueCustomerObject(
      [object("object-a1", customerA, userA), object("object-a2", customerA, userA)],
      customerA,
      userA,
    );
    expect(result).toEqual({ object: null, ambiguous: true });
  });
});
