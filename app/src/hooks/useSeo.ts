import React from "react";
import { COMPANY_PROFILE } from "@/config/businessRules";

type JsonLdNode = Record<string, unknown>;

interface SeoInput {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  robots?: string;
  type?: string;
  structuredData?: JsonLdNode | JsonLdNode[];
}

function ensureMeta(property: "name" | "property", key: string): HTMLMetaElement {
  let el = document.querySelector(`meta[${property}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(property, key);
    document.head.appendChild(el);
  }
  return el;
}

function ensureLink(rel: string): HTMLLinkElement {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el;
}

function ensureJsonLdScript(): HTMLScriptElement {
  let el = document.querySelector('script[data-kpt-seo="jsonld"]') as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-kpt-seo", "jsonld");
    document.head.appendChild(el);
  }
  return el;
}

function normalizePath(path: string): string {
  const raw = String(path || "").trim();
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = normalizePath(pathOrUrl);
  return `${COMPANY_PROFILE.websiteUrl}${normalized}`;
}

function normalizeStructuredData(structuredData: JsonLdNode | JsonLdNode[]): JsonLdNode {
  if (Array.isArray(structuredData)) {
    return {
      "@context": "https://schema.org",
      "@graph": structuredData.map((entry) =>
        entry["@context"] ? { ...entry, "@context": undefined } : entry,
      ),
    };
  }
  if (structuredData["@context"]) return structuredData;
  return {
    "@context": "https://schema.org",
    ...structuredData,
  };
}

export function useSeo({
  title,
  description,
  canonicalPath,
  image = "/kpt-logo.png",
  robots = "index,follow,max-image-preview:large",
  type = "website",
  structuredData,
}: SeoInput) {
  React.useEffect(() => {
    const currentPath = canonicalPath || window.location.pathname;
    const canonicalUrl = toAbsoluteUrl(currentPath);
    const imageUrl = toAbsoluteUrl(image);

    document.title = title;

    ensureMeta("name", "description").setAttribute("content", description);
    ensureMeta("name", "robots").setAttribute("content", robots);
    ensureMeta("property", "og:type").setAttribute("content", type);
    ensureMeta("property", "og:title").setAttribute("content", title);
    ensureMeta("property", "og:description").setAttribute("content", description);
    ensureMeta("property", "og:url").setAttribute("content", canonicalUrl);
    ensureMeta("property", "og:image").setAttribute("content", imageUrl);
    ensureMeta("name", "twitter:card").setAttribute("content", "summary_large_image");
    ensureMeta("name", "twitter:title").setAttribute("content", title);
    ensureMeta("name", "twitter:description").setAttribute("content", description);
    ensureMeta("name", "twitter:image").setAttribute("content", imageUrl);

    ensureLink("canonical").setAttribute("href", canonicalUrl);

    const script = ensureJsonLdScript();
    if (structuredData) {
      script.textContent = JSON.stringify(normalizeStructuredData(structuredData));
    } else {
      script.textContent = "";
    }
  }, [canonicalPath, description, image, robots, structuredData, title, type]);
}
