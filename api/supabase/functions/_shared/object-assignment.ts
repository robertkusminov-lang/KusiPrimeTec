import { serviceClient } from "./client.ts";

function asText(value: unknown, max = 220): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function splitAddress(address: string): { street: string | null; zip: string | null; city: string | null } {
  const raw = asText(address, 220);
  if (!raw) return { street: null, zip: null, city: null };
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const street = parts[0] || null;
  const tail = parts[1] || "";
  const match = tail.match(/^(\d{4,5})\s+(.+)$/);
  if (match) return { street, zip: match[1], city: match[2] };
  return { street, zip: null, city: tail || null };
}

function buildObjectName(input: { customerDisplayName?: unknown; street?: string | null; city?: string | null }): string {
  const customer = asText(input.customerDisplayName, 120);
  const street = asText(input.street, 120);
  const city = asText(input.city, 80);
  if (street && city) return `Objekt ${street}, ${city}`;
  if (street) return `Objekt ${street}`;
  if (city && customer) return `Objekt ${customer} ${city}`;
  if (city) return `Objekt ${city}`;
  if (customer) return `Objekt ${customer}`;
  return "Objekt";
}

async function loadRequesterUserId(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string | null
): Promise<string | null> {
  if (!customerId) return null;
  try {
    const { data, error } = await supabase.from("customers").select("auth_user_id").eq("id", customerId).maybeSingle();
    if (error) return null;
    return asText((data as Record<string, unknown> | null)?.auth_user_id, 80) || null;
  } catch {
    return null;
  }
}

async function loadObjectById(
  supabase: ReturnType<typeof serviceClient>,
  objectId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("objects")
    .select("id,name,street,zip,city,customer_id,requester_user_id,is_active")
    .eq("id", objectId)
    .maybeSingle();
  if (error) return null;
  return (data as Record<string, unknown> | null) || null;
}

async function findMatchingObject(
  supabase: ReturnType<typeof serviceClient>,
  input: { street: string | null; zip: string | null; city: string | null; customerId: string | null }
): Promise<Record<string, unknown> | null> {
  if (!input.street && !input.zip && !input.city) return null;

  let query = supabase
    .from("objects")
    .select("id,name,street,zip,city,customer_id,requester_user_id,is_active")
    .limit(20);

  if (input.street) query = query.eq("street", input.street);
  if (input.zip) query = query.eq("zip", input.zip);
  if (input.city) query = query.eq("city", input.city);

  const { data, error } = await query;
  if (error || !Array.isArray(data) || !data.length) return null;

  const exactCustomer = input.customerId
    ? data.find((row) => asText((row as Record<string, unknown>).customer_id, 80) === input.customerId)
    : null;
  if (exactCustomer) return exactCustomer as Record<string, unknown>;

  const active = data.find((row) => (row as Record<string, unknown>).is_active !== false);
  return (active as Record<string, unknown> | undefined) || (data[0] as Record<string, unknown>);
}

async function syncObjectCustomer(
  supabase: ReturnType<typeof serviceClient>,
  objectRow: Record<string, unknown>,
  input: { customerId: string | null; requesterUserId: string | null; street: string | null; zip: string | null; city: string | null }
): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  const currentCustomerId = asText(objectRow.customer_id, 80) || null;
  const currentRequesterUserId = asText(objectRow.requester_user_id, 80) || null;
  const currentStreet = asText(objectRow.street, 160) || null;
  const currentZip = asText(objectRow.zip, 20) || null;
  const currentCity = asText(objectRow.city, 120) || null;

  if (!currentCustomerId && input.customerId) patch.customer_id = input.customerId;
  if (!currentRequesterUserId && input.requesterUserId) patch.requester_user_id = input.requesterUserId;
  if (!currentStreet && input.street) patch.street = input.street;
  if (!currentZip && input.zip) patch.zip = input.zip;
  if (!currentCity && input.city) patch.city = input.city;

  if (!Object.keys(patch).length) return objectRow;

  patch.updated_at = new Date().toISOString();
  const objectId = asText(objectRow.id, 80);
  if (!objectId) return objectRow;
  const { data, error } = await supabase.from("objects").update(patch).eq("id", objectId).select("*").maybeSingle();
  if (error || !data) return objectRow;
  return data as Record<string, unknown>;
}

export async function ensureTicketObjectAssignment(
  supabase: ReturnType<typeof serviceClient>,
  input: {
    objectId?: unknown;
    customerId?: unknown;
    customerDisplayName?: unknown;
    objectAddress?: unknown;
    objectStreet?: unknown;
    objectZip?: unknown;
    objectCity?: unknown;
  }
): Promise<Record<string, unknown> | null> {
  const currentObjectId = asText(input.objectId, 80) || null;
  const customerId = asText(input.customerId, 80) || null;
  const parsedAddress = splitAddress(asText(input.objectAddress, 220));
  const street = asText(input.objectStreet, 160) || parsedAddress.street;
  const zip = asText(input.objectZip, 20) || parsedAddress.zip;
  const city = asText(input.objectCity, 120) || parsedAddress.city;
  const requesterUserId = await loadRequesterUserId(supabase, customerId);

  let objectRow: Record<string, unknown> | null = null;
  if (currentObjectId) {
    objectRow = await loadObjectById(supabase, currentObjectId);
  }
  if (!objectRow) {
    objectRow = await findMatchingObject(supabase, { street, zip, city, customerId });
  }

  if (!objectRow) {
    if (!street && !zip && !city) return null;
    const payload: Record<string, unknown> = {
      name: buildObjectName({ customerDisplayName: input.customerDisplayName, street, city }),
      street: street || null,
      zip: zip || null,
      city: city || null,
      customer_id: customerId,
      requester_user_id: requesterUserId,
      is_active: true,
    };
    const { data, error } = await supabase.from("objects").insert(payload).select("*").maybeSingle();
    if (error || !data) return null;
    objectRow = data as Record<string, unknown>;
  } else {
    objectRow = await syncObjectCustomer(supabase, objectRow, { customerId, requesterUserId, street, zip, city });
  }

  const objectId = asText(objectRow.id, 80) || null;
  const finalStreet = asText(objectRow.street, 160) || street || null;
  const finalZip = asText(objectRow.zip, 20) || zip || null;
  const finalCity = asText(objectRow.city, 120) || city || null;
  const finalAddress = [finalStreet, [finalZip, finalCity].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;

  if (!objectId) return null;
  return {
    object_id: objectId,
    objekt_strasse: finalStreet,
    objekt_plz: finalZip,
    objekt_ort: finalCity,
    objekt_adresse: finalAddress,
    object_address: finalAddress,
    plz: finalZip,
    ort: finalCity,
    city: finalCity,
  };
}
