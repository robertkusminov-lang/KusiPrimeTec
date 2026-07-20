type SmtpAttachment = {
  filename: string;
  contentType: string;
  contentBytes: Uint8Array;
};

type SendSmtpMailInput = {
  to: string;
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: SmtpAttachment[];
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  fromName: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function stripCrlf(value: string): string {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function base64Bytes(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64Utf8(value: string): string {
  return base64Bytes(encoder.encode(value));
}

function foldBase64(value: string, width = 76): string {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += width) {
    out.push(value.slice(i, i + width));
  }
  return out.join("\r\n");
}

function readConfig(): SmtpConfig | null {
  const host = env("SMTP_HOST");
  const username = env("SMTP_USERNAME");
  const password = env("SMTP_PASSWORD");
  if (!host || !username || !password) return null;

  const portRaw = env("SMTP_PORT");
  const port = Number(portRaw || "465");
  const secureRaw = env("SMTP_SECURE").toLowerCase();
  const secure = secureRaw ? !["0", "false", "no", "off"].includes(secureRaw) : true;
  const from = env("SMTP_FROM") || username;
  const fromName = env("SMTP_FROM_NAME") || "KusiPrimeTec";

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure,
    username,
    password,
    from,
    fromName,
  };
}

export function smtpConfigured(): boolean {
  return Boolean(readConfig());
}

function parseAddress(value: string): string {
  const raw = stripCrlf(value);
  const m = raw.match(/<([^>]+)>/);
  const addr = (m?.[1] || raw).trim().toLowerCase();
  if (!addr || !addr.includes("@")) throw new Error("Ungueltige E-Mail-Adresse.");
  return addr;
}

function buildMime(input: {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: SmtpAttachment[];
}): string {
  const fromAddress = parseAddress(input.from);
  const toAddress = parseAddress(input.to);
  const safeFromName = stripCrlf(input.fromName).replace(/"/g, "'");
  const safeSubject = stripCrlf(input.subject || "Nachricht");

  const subjectHeader = `=?UTF-8?B?${base64Utf8(safeSubject)}?=`;
  const textB64 = foldBase64(base64Utf8(input.text || ""));
  const htmlB64 = foldBase64(base64Utf8(input.html || ""));

  const baseHeaders = [
    `Date: ${new Date().toUTCString()}`,
    `From: "${safeFromName}" <${fromAddress}>`,
    `To: <${toAddress}>`,
    `Subject: ${subjectHeader}`,
    "MIME-Version: 1.0",
  ];

  if (!input.attachments.length) {
    return [
      ...baseHeaders,
      'Content-Type: multipart/alternative; boundary="alt-boundary"',
      "",
      "--alt-boundary",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      textB64,
      "--alt-boundary",
      'Content-Type: text/html; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      htmlB64,
      "--alt-boundary--",
      "",
    ].join("\r\n");
  }

  const out: string[] = [
    ...baseHeaders,
    'Content-Type: multipart/mixed; boundary="mix-boundary"',
    "",
    "--mix-boundary",
    'Content-Type: multipart/alternative; boundary="alt-boundary"',
    "",
    "--alt-boundary",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    textB64,
    "--alt-boundary",
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    "--alt-boundary--",
  ];

  for (const file of input.attachments) {
    const filename = stripCrlf(file.filename || "dokument.bin").replace(/"/g, "");
    const contentType = stripCrlf(file.contentType || "application/octet-stream");
    const fileB64 = foldBase64(base64Bytes(file.contentBytes));
    out.push(
      "--mix-boundary",
      `Content-Type: ${contentType}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      fileB64
    );
  }

  out.push("--mix-boundary--", "");
  return out.join("\r\n");
}

type SmtpConn = Deno.Conn | Deno.TlsConn;

class SmtpReader {
  private buffer = "";
  constructor(private readonly conn: SmtpConn) {}

  async readLine(): Promise<string> {
    while (true) {
      const idx = this.buffer.indexOf("\n");
      if (idx >= 0) {
        const line = this.buffer.slice(0, idx + 1);
        this.buffer = this.buffer.slice(idx + 1);
        return line.replace(/\r?\n$/, "");
      }
      const chunk = new Uint8Array(1024);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("SMTP-Verbindung unerwartet beendet.");
      this.buffer += decoder.decode(chunk.subarray(0, n));
    }
  }
}

async function readResponse(reader: SmtpReader): Promise<{ code: number; message: string }> {
  const lines: string[] = [];
  while (true) {
    const line = await reader.readLine();
    lines.push(line);
    if (line.length < 4 || line[3] === " ") break;
  }
  const code = Number(lines[lines.length - 1]?.slice(0, 3) || 0);
  return { code, message: lines.join("\n") };
}

async function sendLine(conn: SmtpConn, line: string): Promise<void> {
  await conn.write(encoder.encode(`${line}\r\n`));
}

async function expectCode(
  reader: SmtpReader,
  expected: number[],
  action: string
): Promise<void> {
  const res = await readResponse(reader);
  if (!expected.includes(res.code)) {
    throw new Error(`SMTP-Fehler bei ${action}: ${res.message}`);
  }
}

async function sendCommand(
  conn: SmtpConn,
  reader: SmtpReader,
  command: string,
  expected: number[],
  action: string
): Promise<void> {
  await sendLine(conn, command);
  await expectCode(reader, expected, action);
}

export async function sendSmtpMail(input: SendSmtpMailInput): Promise<void> {
  const cfg = readConfig();
  if (!cfg) throw new Error("SMTP ist nicht konfiguriert.");

  const to = parseAddress(input.to);
  const bccList = Array.isArray(input.bcc) ? input.bcc : [];
  const recipients = [...new Set([to, ...bccList.map((value) => parseAddress(value)).filter(Boolean)])];
  const from = parseAddress(cfg.from);
  const subject = stripCrlf(input.subject || "Nachricht");
  const text = String(input.text || "").trim() || "Bitte sehen Sie den HTML-Inhalt dieser Nachricht.";
  const html = String(input.html || "").trim() || text.replace(/\r?\n/g, "<br />");
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];

  const mime = buildMime({
    from,
    fromName: cfg.fromName,
    to,
    subject,
    text,
    html,
    attachments,
  });

  const conn: SmtpConn = cfg.secure
    ? await Deno.connectTls({ hostname: cfg.host, port: cfg.port })
    : await Deno.connect({ hostname: cfg.host, port: cfg.port });

  try {
    const reader = new SmtpReader(conn);
    await expectCode(reader, [220], "Server-Begruessung");
    await sendCommand(conn, reader, `EHLO ${cfg.host}`, [250], "EHLO");
    await sendCommand(conn, reader, "AUTH LOGIN", [334], "AUTH LOGIN");
    await sendCommand(conn, reader, base64Utf8(cfg.username), [334], "SMTP-Benutzername");
    await sendCommand(conn, reader, base64Utf8(cfg.password), [235], "SMTP-Passwort");
    await sendCommand(conn, reader, `MAIL FROM:<${from}>`, [250], "MAIL FROM");
    for (const recipient of recipients) {
      await sendCommand(conn, reader, `RCPT TO:<${recipient}>`, [250, 251], "RCPT TO");
    }
    await sendCommand(conn, reader, "DATA", [354], "DATA");

    const dotEscaped = mime
      .replace(/\r?\n/g, "\r\n")
      .split("\r\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");

    await conn.write(encoder.encode(`${dotEscaped}\r\n.\r\n`));
    await expectCode(reader, [250], "Nachrichtenuebergabe");
    await sendCommand(conn, reader, "QUIT", [221, 250], "QUIT");
  } finally {
    try {
      conn.close();
    } catch {
      // ignore close errors
    }
  }
}
