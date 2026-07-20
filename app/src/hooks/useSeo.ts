import React from "react";

interface SeoInput {
  title: string;
  description: string;
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

export function useSeo({ title, description }: SeoInput) {
  React.useEffect(() => {
    document.title = title;
    const descriptionTag = ensureDescriptionTag();
    descriptionTag.setAttribute("content", description);

    ensureMeta("property", "og:title").setAttribute("content", title);
    ensureMeta("property", "og:description").setAttribute("content", description);
    ensureMeta("name", "twitter:title").setAttribute("content", title);
    ensureMeta("name", "twitter:description").setAttribute("content", description);
  }, [title, description]);
}
