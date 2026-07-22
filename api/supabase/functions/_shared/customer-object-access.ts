export type CustomerObjectRecord = {
  id?: unknown;
  customer_id?: unknown;
  requester_user_id?: unknown;
  is_active?: unknown;
};

export type CustomerTicketRecord = {
  object_id?: unknown;
  customer_id?: unknown;
  requester_user_id?: unknown;
};

function id(value: unknown): string {
  return String(value || "").trim();
}

export function isObjectOwnedByCustomer(
  object: CustomerObjectRecord | null | undefined,
  customerId: string,
  requesterUserId: string | null,
): boolean {
  if (!object || object.is_active !== true) return false;
  if (!customerId || id(object.customer_id) !== customerId) return false;

  const objectRequesterId = id(object.requester_user_id);
  if (requesterUserId) return objectRequesterId === requesterUserId;
  return !objectRequesterId;
}

export function isObjectAssignableToCustomer(
  object: CustomerObjectRecord | null | undefined,
  customerId: string,
  requesterUserId: string | null,
): boolean {
  if (!object || object.is_active !== true) return false;
  if (!customerId || id(object.customer_id) !== customerId) return false;

  const objectRequesterId = id(object.requester_user_id);
  if (!objectRequesterId) return true;
  return Boolean(requesterUserId) && objectRequesterId === requesterUserId;
}

export function selectUniqueCustomerObject(
  candidates: CustomerObjectRecord[],
  customerId: string,
  requesterUserId: string | null,
): { object: CustomerObjectRecord | null; ambiguous: boolean } {
  const matches = candidates.filter((candidate) =>
    isObjectAssignableToCustomer(candidate, customerId, requesterUserId),
  );
  return {
    object: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
  };
}

export function isTicketObjectConsistent(
  ticket: CustomerTicketRecord,
  object: CustomerObjectRecord | null | undefined,
): boolean {
  if (!object || object.is_active !== true) return false;
  const ticketCustomerId = id(ticket.customer_id);
  const objectCustomerId = id(object.customer_id);
  if (!ticketCustomerId || ticketCustomerId !== objectCustomerId) return false;

  const ticketRequesterId = id(ticket.requester_user_id);
  const objectRequesterId = id(object.requester_user_id);
  return !ticketRequesterId || ticketRequesterId === objectRequesterId;
}

export function canCustomerAccessTicket(
  ticket: CustomerTicketRecord,
  object: CustomerObjectRecord | null | undefined,
  customerId: string,
  requesterUserId: string,
): boolean {
  if (!isObjectOwnedByCustomer(object, customerId, requesterUserId)) return false;
  if (!isTicketObjectConsistent(ticket, object)) return false;
  return id(ticket.object_id) === id(object?.id);
}
