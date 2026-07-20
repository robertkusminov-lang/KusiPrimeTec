function toB64(input: Uint8Array): string {
  let s = "";
  input.forEach((v) => (s += String.fromCharCode(v)));
  return btoa(s);
}

function fromB64(v: string): Uint8Array {
  const bin = atob(v);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptText(text: string, secret: string): Promise<{ iv: string; cipher: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret);
  const payload = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return { iv: toB64(iv), cipher: toB64(new Uint8Array(encrypted)) };
}

export async function decryptText(cipher: string, iv: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(cipher));
  return new TextDecoder().decode(decrypted);
}


