import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "app", "dist");
const baseHtml = await readFile(path.join(distDir, "index.html"), "utf8");
const origin = "https://kusiprimetec.de";
const entryPath = baseHtml.match(/<script\s+type="module"[^>]+src="([^"]+)"/)?.[1];
const entrySource = entryPath ? await readFile(path.join(distDir, entryPath.replace(/^\//, "")), "utf8") : "";
const appAsset = entrySource.match(/\.\/(App-[A-Za-z0-9_-]+\.js)/)?.[1];
const appSource = appAsset ? await readFile(path.join(distDir, "assets", appAsset), "utf8") : "";
const objectCheckAsset = appSource.match(/\.\/(ObjectCheckPage-[A-Za-z0-9_-]+\.js)/)?.[1];

const publicRoutes = {
  "/": {
    title: "Technischer Immobilienservice & Objektbetreuung in Schorndorf | KusiPrimeTec",
    description: "Technischer Immobilienservice und planbare Objektbetreuung für Bestandsobjekte in Schorndorf und 30 km Umgebung. Direkt und unverbindlich anfragen.",
    h1: "Technischer Immobilienservice für Bestandsobjekte",
    lead: "Objektbetreuung, Kleinreparaturen, Instandhaltung und handwerklich-technischer Allround-Service im zulässigen Rahmen.",
  },
  "/leistungen": {
    title: "Technische Objektbetreuung und Kleinreparaturen | KusiPrimeTec",
    description: "Technische Objektbetreuung, Störungsaufnahme, Sichtkontrollen, geeignete Kleinreparaturen und Fachfirmenkoordination im Raum Schorndorf.",
    h1: "Technischer Immobilienservice im Überblick",
    lead: "Planbare Unterstützung für Bestandsobjekte im Raum Schorndorf.",
  },
  "/hausmeisterservice": {
    title: "Objekt- & Hausmeisterservice in Schorndorf | KusiPrimeTec",
    description: "Objektkontrollen, geeignete Kleinreparaturen und dokumentierter Hausmeisterservice für Wohn- und Gewerbeobjekte in Schorndorf und Umgebung.",
    h1: "Objekt- und Hausmeisterservice",
    lead: "Kontrollen, Dokumentation und geeignete Kleinreparaturen für Bestandsobjekte.",
  },
  "/objektbetreuung": {
    title: "Objektbetreuung mit monatlichem Stundenkontingent | KusiPrimeTec",
    description: "Planbare technische Objektbetreuung mit monatlichem Stundenkontingent, digitalen Rapporten und klarer Leistungsabgrenzung im Raum Schorndorf.",
    h1: "Planbare Objektbetreuung für Bestandsobjekte",
    lead: "Monatliche Betreuung mit klaren Abläufen und nachvollziehbaren Einsatzrapporten.",
  },
  "/objektcheck": {
    title: "Kostenloser ObjektCheck für Gewerbeimmobilien im Remstal | KusiPrimeTec",
    description: "In 2 Minuten erkennen, wie gut Kontrolle, Mängelmanagement, Vertretung und technische Objektbetreuung organisiert sind. Sofortergebnis ohne Anmeldung.",
    h1: "Wie gut ist Ihr Objekt im Alltag betreut?",
    lead: "Acht kurze Fragen mit Sofortergebnis, ohne Anmeldung und ohne Kontaktdaten.",
  },
  "/hausmeisterservice-schorndorf": {
    title: "Hausmeisterservice in Schorndorf für Bestandsobjekte | KusiPrimeTec",
    description: "Objektkontrollen, Mängeldokumentation und zulässige Kleinreparaturen für Gewerbe-, Wohn- und Mischobjekte in Schorndorf und Umgebung.",
    h1: "Hausmeisterservice in Schorndorf für Bestandsobjekte",
    lead: "Regionale Unterstützung für Objektkontrollen, Mängeldokumentation und zulässige Kleinreparaturen.",
  },
  "/objektbetreuung-remstal": {
    title: "Technische Objektbetreuung im Remstal | KusiPrimeTec",
    description: "Planbare Objektkontrollen, Mängelmanagement, Vertretung und Fachfirmenkoordination für Unternehmen, Verwaltungen und Eigentümer im Remstal.",
    h1: "Technische Objektbetreuung im Remstal",
    lead: "Planbare Betreuung für Unternehmen, Verwaltungen und Eigentümer im laufenden Objektbetrieb.",
  },
  "/technischer-stoerungsservice-schorndorf": {
    title: "Technischer Störungsservice in Schorndorf | KusiPrimeTec",
    description: "Strukturierte Störungsaufnahme, Dokumentation, zulässige Kleinreparaturen und Fachfirmenkoordination für Bestandsobjekte im Raum Schorndorf.",
    h1: "Technischer Störungsservice in Schorndorf",
    lead: "Strukturierte Aufnahme, Dokumentation und Koordination technischer Störungen im Bestandsobjekt.",
  },
  "/preise": {
    title: "Preise für Objektbetreuung & technischen Service | KusiPrimeTec",
    description: "Transparente Preise für technischen Immobilienservice, Objekt- und Hausmeisterservice sowie monatliche Objektbetreuung bei KusiPrimeTec.",
    h1: "Preise und Betreuungsmodelle",
    lead: "Transparente Konditionen für Einzelaufträge und planbare Objektbetreuung.",
  },
  "/ablauf": {
    title: "Ablauf, Tickets und digitale Einsatzrapporte | KusiPrimeTec",
    description: "Vom Erstkontakt über Ticket und Termin bis zum digitalen Einsatzrapport: So läuft die technische Betreuung bei KusiPrimeTec nachvollziehbar ab.",
    h1: "So läuft die Zusammenarbeit ab",
    lead: "Vom Erstkontakt bis zum digitalen Einsatzrapport klar und nachvollziehbar organisiert.",
  },
  "/buchen": {
    title: "Technischen Immobilienservice anfragen | KusiPrimeTec",
    description: "Technischen Immobilienservice, Einzelauftrag oder laufende Objektbetreuung in Schorndorf unverbindlich bei KusiPrimeTec anfragen.",
    h1: "Passenden Service auswählen",
    lead: "Einzelauftrag oder laufende Objektbetreuung unverbindlich anfragen.",
  },
  "/einzelauftrag": {
    title: "Einzelauftrag anfragen | KusiPrimeTec",
    description: "Anfrageformular für einen technischen Einzelauftrag bei KusiPrimeTec.",
    h1: "Einzelauftrag anfragen",
    lead: "Übermitteln Sie die Eckdaten Ihres technischen Anliegens unverbindlich.",
  },
  "/objektbetreuung-anfrage": {
    title: "Objektbetreuung anfragen | KusiPrimeTec",
    description: "Anfrageformular für Objektbetreuung und technischen Service bei KusiPrimeTec.",
    h1: "Objektbetreuung anfragen",
    lead: "Teilen Sie uns die Eckdaten Ihres Objekts und des gewünschten Betreuungsumfangs mit.",
  },
};

const noindexRoutes = {
  "/konto/anmelden": ["Kundenlogin | KusiPrimeTec", "Geschützter Kundenlogin von KusiPrimeTec.", "Kundenlogin"],
  "/impressum": ["Impressum | KusiPrimeTec", "Impressum und Anbieterinformationen von KusiPrimeTec.", "Impressum"],
  "/datenschutz": ["Datenschutz | KusiPrimeTec", "Datenschutzhinweise von KusiPrimeTec.", "Datenschutz"],
  "/agb": ["Allgemeine Geschäftsbedingungen | KusiPrimeTec", "Allgemeine Geschäftsbedingungen von KusiPrimeTec.", "Allgemeine Geschäftsbedingungen"],
  "/widerruf": ["Widerruf | KusiPrimeTec", "Informationen zum Widerruf bei KusiPrimeTec.", "Widerruf"],
  "/haftung-koordination": ["Haftung und Koordination | KusiPrimeTec", "Hinweise zu Haftung, Leistungsgrenzen und Fachfirmenkoordination bei KusiPrimeTec.", "Haftung und Koordination"],
};

const labels = {
  "/leistungen": "Leistungen",
  "/hausmeisterservice": "Hausmeisterservice",
  "/objektbetreuung": "Objektbetreuung",
  "/objektcheck": "ObjektCheck",
  "/hausmeisterservice-schorndorf": "Hausmeisterservice Schorndorf",
  "/objektbetreuung-remstal": "Objektbetreuung Remstal",
  "/technischer-stoerungsservice-schorndorf": "Technischer Störungsservice Schorndorf",
  "/preise": "Preise",
  "/ablauf": "Ablauf",
  "/buchen": "Anfrage",
};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function replaceMeta(html, attribute, key, value) {
  const expression = new RegExp(`<meta\\s+${attribute}="${key}"[\\s\\S]*?\\/>`, "i");
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  return expression.test(html) ? html.replace(expression, tag) : html.replace("</head>", `  ${tag}\n  </head>`);
}

function routeSchemas(route, entry) {
  const schemas = [];
  if (route !== "/") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Startseite", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: labels[route] || entry.h1, item: `${origin}${route}` },
      ],
    });
  }
  if (["/leistungen", "/hausmeisterservice", "/objektbetreuung", "/hausmeisterservice-schorndorf", "/objektbetreuung-remstal", "/technischer-stoerungsservice-schorndorf"].includes(route)) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Service",
      name: entry.h1,
      description: entry.description,
      provider: { "@id": `${origin}/#business` },
      areaServed: "Schorndorf und 30 km Umgebung",
      url: `${origin}${route}`,
    });
  }
  if (route === "/objektcheck") {
    const faq = [
      ["Ist das Ergebnis eine technische Prüfung?", "Nein. Es ist ausschließlich eine organisatorische Ersteinschätzung anhand Ihrer Angaben."],
      ["Muss ich Kontaktdaten angeben?", "Nein. Der vollständige Check und das Ergebnis funktionieren ohne Anmeldung und ohne Kontaktdaten."],
      ["Werden meine Antworten gespeichert?", "Nein. Die Antworten werden nur für den aktuellen Durchlauf im Arbeitsspeicher des Browsers gehalten."],
      ["Kann ich das Ergebnis aufbewahren?", "Ja. Das Ergebnis kann über die Druckfunktion des Browsers als PDF gespeichert werden."],
    ];
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }
  return schemas;
}

function fallbackMarkup(entry, route) {
  const nav = [
    ["/", "Startseite"], ["/leistungen", "Leistungen"], ["/objektbetreuung", "Objektbetreuung"],
    ["/objektcheck", "ObjektCheck"], ["/preise", "Preise"], ["/buchen", "Anfragen"],
  ].map(([href, text]) => `<a href="${href}"${href === route ? ' aria-current="page"' : ""}>${text}</a>`).join("");
  return `<div class="prerender-shell"><header><a href="/" aria-label="KusiPrimeTec Startseite"><strong>KusiPrimeTec</strong></a><nav aria-label="Hauptnavigation">${nav}</nav></header><main><p>Technischer Immobilienservice im Bestand</p><h1>${escapeHtml(entry.h1)}</h1><p>${escapeHtml(entry.lead)}</p><div><a href="/objektcheck">Kostenlosen ObjektCheck starten</a><a href="/objektbetreuung-anfrage">Objektbetreuung anfragen</a></div>${additionalContent(route)}</main><footer><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></footer></div>`;
}

function additionalContent(route) {
  if (route === "/objektcheck") {
    return `<section><h2>Für wen ist der ObjektCheck gedacht?</h2><p>Für Unternehmen, Verwaltungen und Eigentümer im Raum Schorndorf und Remstal.</p><h2>Welche Bereiche werden betrachtet?</h2><p>Kontrollrhythmus, Mängeldokumentation, Störungsreaktion, Vertretung und Fachfirmenkoordination.</p><h2>So funktioniert der Check</h2><p>Acht kurze Fragen werden direkt im Browser ausgewertet. Das vollständige Ergebnis ist ohne Anmeldung sichtbar.</p><h2>Beispiel eines anonymisierten Ergebnisses</h2><p>Eine mögliche Einordnung lautet Punktueller Optimierungsbedarf und nennt drei organisatorische nächste Schritte.</p><h2>Was passiert mit meinen Antworten?</h2><p>Die Antworten bleiben im Arbeitsspeicher des Browsers und werden vor einer freiwilligen Kontaktaktion nicht an einen Server gesendet.</p><h2>Objektbetreuung im Raum Schorndorf und Remstal</h2><p>KusiPrimeTec unterstützt Bestandsobjekte mit Kontrollen, Mängeldokumentation, zulässigen Kleinreparaturen und organisatorischer Fachfirmenkoordination.</p><h2>Häufig gestellte Fragen</h2><p>Der Check funktioniert ohne Kontaktdaten; das Ergebnis kann über die Druckfunktion als PDF gespeichert werden.</p><h2>Rechtliche Abgrenzung</h2><p>Der digitale ObjektCheck ist eine unverbindliche organisatorische Ersteinschätzung auf Grundlage Ihrer Angaben. Er ersetzt keine technische Prüfung, Sicherheitsprüfung, Gefährdungsbeurteilung, Sachverständigenleistung oder gesetzlich vorgeschriebene Prüfung.</p></section>`;
  }
  if (["/hausmeisterservice-schorndorf", "/objektbetreuung-remstal", "/technischer-stoerungsservice-schorndorf"].includes(route)) {
    return `<section><h2>Unterstützung für Bestandsobjekte</h2><p>Geeignet für Unternehmen, Verwaltungen und Eigentümer mit Bestandsobjekten im regionalen Einsatzgebiet.</p><h2>Typische Einsatzfälle</h2><p>Objektkontrollen, Mängeldokumentation, zulässige Kleinreparaturen und organisatorische Koordination erforderlicher Fachunternehmen.</p><h2>Einsatzgebiet und Leistungsgrenzen</h2><p>KusiPrimeTec arbeitet ungefähr 30 Kilometer um Schorndorf. Zulassungspflichtige Facharbeiten, Sicherheitsprüfungen und Sachverständigenleistungen sind nicht Bestandteil des Angebots.</p><p><a href="/leistungen">Leistungen im Überblick</a> <a href="/preise">Preise für den Objektservice ansehen</a></p></section>`;
  }
  return "";
}

function renderDocument(route, entry, indexable, follow = false) {
  const canonical = `${origin}${route === "/" ? "/" : route}`;
  const robots = indexable ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" : `noindex,${follow ? "follow" : "nofollow"},noarchive`;
  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(entry.title)}</title>`);
  html = replaceMeta(html, "name", "description", entry.description);
  html = replaceMeta(html, "name", "robots", robots);
  html = replaceMeta(html, "name", "googlebot", robots);
  html = replaceMeta(html, "property", "og:title", entry.title);
  html = replaceMeta(html, "property", "og:description", entry.description);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", entry.title);
  html = replaceMeta(html, "name", "twitter:description", entry.description);
  html = html.replace(/<link\s+rel="canonical"[\s\S]*?\/>/i, `<link rel="canonical" href="${canonical}" />`);
  if (indexable) {
    const schemas = routeSchemas(route, entry);
    if (schemas.length) {
      html = html.replace("</head>", `  <script type="application/ld+json" data-kpt-route-schema>${JSON.stringify(schemas.length === 1 ? schemas[0] : schemas)}</script>\n  </head>`);
    }
  }
  const modulePreloads = [
    appAsset ? `/assets/${appAsset}` : "",
    route === "/objektcheck" && objectCheckAsset ? `/assets/${objectCheckAsset}` : "",
  ].filter(Boolean);
  if (modulePreloads.length) {
    html = html.replace(
      "</head>",
      `  ${modulePreloads.map((href) => `<link rel="modulepreload" href="${href}" />`).join("\n  ")}\n  </head>`,
    );
  }
  const handoff = `<script>document.documentElement.classList.add("js")</script><style>.js #root[data-prerendered="true"]{display:none}.prerender-shell{min-height:100vh;background:#070e1a;color:#e7eef9;font:16px/1.6 sans-serif}.prerender-shell header,.prerender-shell main,.prerender-shell footer{max-width:1180px;margin:auto;padding:24px}.prerender-shell nav,.prerender-shell main div,.prerender-shell footer{display:flex;gap:18px;flex-wrap:wrap}.prerender-shell a{color:#7dd3fc}.prerender-shell h1{max-width:900px;font-size:clamp(2rem,6vw,4.5rem);line-height:1.05}.prerender-shell main>p{max-width:780px}</style>`;
  html = html.replace("</head>", `  ${handoff}\n  </head>`);
  return html.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered="true">${fallbackMarkup(entry, route)}</div>`,
  );
}

async function writeRoute(route, html) {
  if (route === "/") {
    await writeFile(path.join(distDir, "index.html"), html, "utf8");
    return;
  }
  const routeDir = path.join(distDir, route.slice(1));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), html, "utf8");
}

for (const [route, entry] of Object.entries(publicRoutes)) {
  await writeRoute(route, renderDocument(route, entry, true));
}

for (const [route, [title, description, h1]] of Object.entries(noindexRoutes)) {
  const follow = route !== "/konto/anmelden";
  await writeRoute(route, renderDocument(route, { title, description, h1, lead: description }, false, follow));
}

const privateEntry = { title: "Geschützter Bereich | KusiPrimeTec", description: "Geschützter Bereich von KusiPrimeTec.", h1: "Geschützter Bereich", lead: "Bitte melden Sie sich an, um fortzufahren." };
const privateShell = renderDocument("/konto", privateEntry, false)
  .replace(/\s*<link\s+rel="canonical"[\s\S]*?\/>/i, "")
  .replace(/\s*<meta\s+property="og:url"[\s\S]*?\/>/i, "");
await writeFile(path.join(distDir, "private-shell.html"), privateShell, "utf8");

const notFoundEntry = { title: "Seite nicht gefunden | KusiPrimeTec", description: "Die angeforderte Seite wurde nicht gefunden.", h1: "Seite nicht gefunden", lead: "Bitte prüfen Sie die Adresse oder wählen Sie eine der folgenden Seiten." };
await writeFile(path.join(distDir, "404.html"), renderDocument("/404", notFoundEntry, false), "utf8");

console.log(`Prerendered ${Object.keys(publicRoutes).length} public routes, ${Object.keys(noindexRoutes).length} noindex routes, private shell and 404 page.`);
