import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("public SEO foundation", () => {
  it("publishes only indexable marketing routes in the sitemap", () => {
    const sitemap = source("../../app/public/sitemap.xml");
    const indexablePaths = [
      "https://kusiprimetec.de/",
      "https://kusiprimetec.de/leistungen",
      "https://kusiprimetec.de/hausmeisterservice",
      "https://kusiprimetec.de/objektbetreuung",
      "https://kusiprimetec.de/objektcheck",
      "https://kusiprimetec.de/hausmeisterservice-schorndorf",
      "https://kusiprimetec.de/objektbetreuung-remstal",
      "https://kusiprimetec.de/technischer-stoerungsservice-schorndorf",
      "https://kusiprimetec.de/preise",
      "https://kusiprimetec.de/ablauf",
      "https://kusiprimetec.de/buchen",
      "https://kusiprimetec.de/einzelauftrag",
      "https://kusiprimetec.de/objektbetreuung-anfrage",
    ];

    indexablePaths.forEach((url) => expect(sitemap).toContain(`<loc>${url}</loc>`));
    expect(sitemap.match(/<url>/g)).toHaveLength(indexablePaths.length);
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/konto");
    expect(sitemap).not.toContain("/impressum");
  });

  it("keeps protected and legal routes out of the index", () => {
    const routeConfig = source("../../app/src/config/site.ts");
    const headers = source("../../app/public/_headers");
    const robots = source("../../app/public/robots.txt");

    expect(routeConfig).toContain('path.startsWith("/admin/")');
    expect(routeConfig).toContain('path.startsWith("/konto/")');
    expect(headers).toContain("/admin/*");
    expect(headers).toContain("/konto/*");
    expect(headers).toContain("X-Robots-Tag: noindex, nofollow, noarchive");
    expect(headers).toContain("X-Robots-Tag: noindex, follow, noarchive");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toContain("Disallow: /admin/");
    expect(robots).not.toContain("Disallow: /konto/");
  });

  it("provides canonical, social and evidence-based structured data", () => {
    const html = source("../../app/index.html");
    const seoHook = source("../../app/src/hooks/useSeo.ts");
    const schemas = source("../../app/src/lib/seoSchemas.ts");

    expect(html).toContain('"@type": ["LocalBusiness", "ProfessionalService"]');
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain('"streetAddress": "Epplerinweg 31"');
    expect(html).not.toContain("aggregateRating");
    expect(seoHook).toContain('ensureMeta("name", "robots")');
    expect(seoHook).toContain('ensureMeta("property", "og:image")');
    expect(seoHook).toContain("getRouteSchemas");
    expect(schemas).toContain('"@type": "BreadcrumbList"');
    expect(schemas).toContain('"@type": "Service"');
    expect(schemas).toContain('"@type": "FAQPage"');
  });

  it("redirects only routes confirmed as deprecated", () => {
    const redirects = source("../../app/public/_redirects");

    expect(redirects).not.toContain("/objektcheck /objektbetreuung 301");
    expect(redirects).toContain("/referenzen / 301");
    expect(redirects).toContain("/ueber-kusiprimetec / 301");
    expect(redirects).toContain("/* /404.html 404");
  });

  it("builds route-specific HTML without exposing protected content", () => {
    const packageJson = source("../../app/package.json");
    const prerender = source("../../scripts/prerender-public.mjs");

    expect(packageJson).toContain("prerender-public.mjs");
    expect(prerender).toContain('"/objektcheck"');
    expect(prerender).toContain('"/hausmeisterservice-schorndorf"');
    expect(prerender).toContain('"/objektbetreuung-remstal"');
    expect(prerender).toContain('"/technischer-stoerungsservice-schorndorf"');
    expect(prerender).toContain('"private-shell.html"');
    expect(prerender).toContain('rel="canonical"');
    expect(prerender).toContain('property="og:url"');
    expect(prerender).toContain('rel="modulepreload"');
    expect(prerender).toContain('document.documentElement.classList.add("js")');
    expect(prerender).toContain('.js #root[data-prerendered="true"]{display:none}');
    expect(prerender).not.toContain("VITE_SUPABASE_ANON_KEY");
  });

  it("keeps keyboard access and defensive response headers in place", () => {
    const layout = source("../../app/src/components/layout/SiteLayout.tsx");
    const header = source("../../app/src/components/layout/SiteHeader.tsx");
    const headers = source("../../app/public/_headers");

    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
    expect(header).toContain("aria-expanded={open}");
    expect(header).toContain('aria-controls="mobile-navigation"');
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("Strict-Transport-Security:");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  });
});
