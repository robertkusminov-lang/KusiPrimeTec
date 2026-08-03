import React from "react";
import { SITE, absoluteSiteUrl, getRouteSeo } from "@/config/site";
import { getRouteSchemas } from "@/lib/seoSchemas";

interface SeoInput {
  title?: string;
  description?: string;
  canonicalPath?: string;
  pathname?: string;
}

function ensureDescriptionTag(): HTMLMetaElement {
  let el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "description");
    document.head.appendChild(el);
  }
  return el;
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

function ensureCanonical(): HTMLLinkElement {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  return el;
}

export function useSeo({ title, description, canonicalPath, pathname }: SeoInput) {
  React.useEffect(() => {
    const currentPath = pathname || window.location.pathname;
    const routeSeo = getRouteSeo(currentPath, { title, description, canonicalPath });
    const canonicalUrl = absoluteSiteUrl(routeSeo.canonicalPath);
    const robots = routeSeo.index
      ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
      : `noindex,${routeSeo.follow === false ? "nofollow" : "follow"},noarchive`;
    const socialImage = absoluteSiteUrl(SITE.socialImagePath);

    document.title = routeSeo.title;
    const descriptionTag = ensureDescriptionTag();
    descriptionTag.setAttribute("content", routeSeo.description);

    ensureMeta("name", "robots").setAttribute("content", robots);
    ensureMeta("name", "googlebot").setAttribute("content", robots);
    ensureMeta("property", "og:type").setAttribute("content", "website");
    ensureMeta("property", "og:locale").setAttribute("content", SITE.locale);
    ensureMeta("property", "og:site_name").setAttribute("content", SITE.name);
    ensureMeta("property", "og:title").setAttribute("content", routeSeo.title);
    ensureMeta("property", "og:description").setAttribute("content", routeSeo.description);
    ensureMeta("property", "og:url").setAttribute("content", canonicalUrl);
    ensureMeta("property", "og:image").setAttribute("content", socialImage);
    ensureMeta("property", "og:image:alt").setAttribute("content", "KusiPrimeTec Logo");
    ensureMeta("name", "twitter:card").setAttribute("content", "summary_large_image");
    ensureMeta("name", "twitter:title").setAttribute("content", routeSeo.title);
    ensureMeta("name", "twitter:description").setAttribute("content", routeSeo.description);
    ensureMeta("name", "twitter:image").setAttribute("content", socialImage);
    ensureCanonical().setAttribute("href", canonicalUrl);

    const schemas = routeSeo.index ? getRouteSchemas(routeSeo.canonicalPath) : [];
    let schemaScript = document.querySelector<HTMLScriptElement>('script[data-kpt-route-schema]');
    if (schemas.length) {
      if (!schemaScript) {
        schemaScript = document.createElement("script");
        schemaScript.type = "application/ld+json";
        schemaScript.dataset.kptRouteSchema = "true";
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
    } else {
      schemaScript?.remove();
    }
  }, [canonicalPath, description, pathname, title]);
}
