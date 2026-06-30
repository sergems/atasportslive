import { useEffect } from "react";

export const SITE_NAME = "ATA Sports Live";
export const SITE_URL = "https://atasportslive.com";
export const DEFAULT_OG_IMAGE = "https://atasportslive.com/opengraph.jpg";
export const DEFAULT_DESCRIPTION =
  "Watch live Pool and Boxing matches from across Africa. Bet peer-to-peer in real-time on Africa's #1 sports betting exchange. Stream from $1.50/day.";

interface SEOOptions {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  ogType?: string;
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

export function useSEO({
  title,
  description,
  path,
  ogImage,
  ogType = "website",
  noindex,
  jsonLd,
}: SEOOptions) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    const desc = description || DEFAULT_DESCRIPTION;
    const image = ogImage || DEFAULT_OG_IMAGE;
    const canonical = path ? `${SITE_URL}${path}` : SITE_URL;

    document.title = fullTitle;

    setMeta(
      "robots",
      noindex
        ? "noindex, nofollow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
    );
    setMeta("description", desc);

    setMeta("og:site_name", SITE_NAME, true);
    setMeta("og:type", ogType, true);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", desc, true);
    setMeta("og:image", image, true);
    setMeta("og:image:alt", `${title} — ${SITE_NAME}`, true);
    setMeta("og:url", canonical, true);
    setMeta("og:locale", "en_UG", true);

    setMeta("twitter:card", "summary_large_image", true);
    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", desc, true);
    setMeta("twitter:image", image, true);
    setMeta("twitter:image:alt", `${title} — ${SITE_NAME}`, true);

    setLink("canonical", canonical);

    if (jsonLd) setJsonLd(jsonLd);
  }, [title, description, path, ogImage, ogType, noindex]);
}

// ─── Schema Helpers ──────────────────────────────────────────────────────────

export function makeBreadcrumb(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function makeSportsEvent(opts: {
  name: string;
  sport: string;
  startDate: string;
  url: string;
  location?: string;
  description?: string;
  status?: "EventScheduled" | "EventLive" | "EventCompleted" | "EventCancelled";
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: opts.name,
    sport: opts.sport,
    startDate: opts.startDate,
    url: opts.url,
    description: opts.description || "",
    eventStatus: `https://schema.org/${opts.status || "EventScheduled"}`,
    location: opts.location
      ? { "@type": "Place", name: opts.location }
      : { "@type": "Place", name: "Africa" },
    organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function makeVideoObject(opts: {
  name: string;
  description: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: opts.name,
    description: opts.description,
    thumbnailUrl: opts.thumbnailUrl || DEFAULT_OG_IMAGE,
    uploadDate: opts.uploadDate || new Date().toISOString().split("T")[0],
    url: opts.url,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function makeCollectionPage(opts: {
  name: string;
  description: string;
  url: string;
  items?: { name: string; url: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    ...(opts.items?.length
      ? {
          hasPart: opts.items.map((item) => ({
            "@type": "WebPage",
            name: item.name,
            url: item.url,
          })),
        }
      : {}),
  };
}

// ─── Structured Data Constants ────────────────────────────────────────────────

export const STRUCTURED_DATA = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "Advanced Talent Agency Sports",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/ata-logo.png`,
      width: 512,
      height: 512,
    },
    description:
      "Africa's premier live sports streaming and P2P betting exchange. Watch Pool and Boxing matches and bet peer-to-peer.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Nsambya",
      addressLocality: "Kampala",
      addressCountry: "UG",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+256-772-364-513",
      contactType: "customer service",
      areaServed: "UG",
      availableLanguage: "English",
    },
    sameAs: [],
  },

  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/streams?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },

  sportsOrg: {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${SITE_URL}/#sportsorg`,
    name: SITE_NAME,
    url: SITE_URL,
    sport: ["Pool", "Boxing"],
    description:
      "Live Pool and Boxing streaming with peer-to-peer betting exchange across Africa.",
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

  faq: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does it cost to watch live streams on ATA Sports Live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Streaming costs $1.50 per day per stream. You pay from your wallet balance and receive 24-hour access to the stream.",
        },
      },
      {
        "@type": "Question",
        name: "How does P2P betting work on ATA Sports Live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You place a bet at your desired odds. When another user matches your bet, the bet is locked in. The winner receives the total stake minus a 10% brokerage fee.",
        },
      },
      {
        "@type": "Question",
        name: "What payment methods are accepted on ATA Sports Live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ATA Sports Live accepts MTN Mobile Money, Airtel Money, and Bitcoin (via Binance) for deposits and withdrawals.",
        },
      },
      {
        "@type": "Question",
        name: "What sports can I watch and bet on?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can watch and bet on Pool (billiards) and Boxing matches streamed live from across Africa.",
        },
      },
      {
        "@type": "Question",
        name: "Is ATA Sports Live available outside Uganda?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. ATA Sports Live streams are accessible across Africa. Anyone with an internet connection can register, fund their wallet, and watch live matches.",
        },
      },
    ],
  },
};
