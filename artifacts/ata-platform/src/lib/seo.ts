import { useEffect } from "react";

const SITE_NAME = "ATA Sports Live";
const DEFAULT_DESCRIPTION =
  "Watch live Pool and Boxing matches from across Africa. Bet peer-to-peer in real-time on Africa's top sports betting exchange. Stream from $1.50/day.";
const DEFAULT_OG_IMAGE = "https://atasportslive.com/opengraph.jpg";
const SITE_URL = "https://atasportslive.com";

interface SEOOptions {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: object | object[];
}

function setMeta(name: string, content: string, prop = false) {
  const attr = prop ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data: object | object[]) {
  const existing = document.querySelectorAll('script[data-seo="ld"]');
  existing.forEach((el) => el.remove());

  const schemas = Array.isArray(data) ? data : [data];
  schemas.forEach((schema) => {
    const el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo", "ld");
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
  });
}

export function useSEO({ title, description, path, ogImage, noindex, jsonLd }: SEOOptions) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    const desc = description || DEFAULT_DESCRIPTION;
    const image = ogImage || DEFAULT_OG_IMAGE;
    const canonical = path ? `${SITE_URL}${path}` : SITE_URL;

    document.title = fullTitle;

    setMeta("description", desc);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow");

    setMeta("og:title", fullTitle, true);
    setMeta("og:description", desc, true);
    setMeta("og:image", image, true);
    setMeta("og:url", canonical, true);

    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", desc, true);
    setMeta("twitter:image", image, true);

    setLink("canonical", canonical);

    if (jsonLd) setJsonLd(jsonLd);
  }, [title, description, path, ogImage, noindex]);
}

export const STRUCTURED_DATA = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ATA Sports Live",
    url: "https://atasportslive.com",
    logo: "https://atasportslive.com/ata-logo.png",
    sameAs: [],
    description:
      "Africa's premier live sports streaming and P2P betting exchange. Watch Pool and Boxing matches and bet peer-to-peer.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kampala",
      addressCountry: "UG",
    },
  },

  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ATA Sports Live",
    url: "https://atasportslive.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://atasportslive.com/streams?search={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },

  sportsOrg: {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: "ATA Sports Live",
    url: "https://atasportslive.com",
    sport: ["Pool", "Boxing"],
    location: {
      "@type": "Place",
      name: "Kampala, Uganda",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kampala",
        addressCountry: "UG",
      },
    },
  },
};
