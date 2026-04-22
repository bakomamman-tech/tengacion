import { useEffect } from "react";

import {
  buildCanonicalUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE_ALT,
  DEFAULT_IMAGE_PATH,
  DEFAULT_OG_TYPE,
  DEFAULT_TITLE,
  DEFAULT_TWITTER_CARD,
  resolveSeoImage,
  SITE_NAME,
  truncateDescription,
} from "../../lib/seo";

const ensureElement = (selector, createElement) => {
  if (typeof document === "undefined") {
    return null;
  }

  let element = document.head.querySelector(selector);
  if (!element) {
    element = createElement();
    element.setAttribute("data-seo-managed", "true");
    document.head.appendChild(element);
  }
  return element;
};

const ensureMetaTag = (attribute, value) =>
  ensureElement(`meta[${attribute}="${value}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute(attribute, value);
    return meta;
  });

const ensureLinkTag = (rel) =>
  ensureElement(`link[rel="${rel}"]`, () => {
    const link = document.createElement("link");
    link.setAttribute("rel", rel);
    return link;
  });

const ensureStructuredDataScript = () =>
  ensureElement('script[data-seo-key="structured-data"], script[data-seo-managed="json-ld"]', () => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-managed", "json-ld");
    return script;
  });

const serializeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

export default function SeoHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = "/",
  robots = "index,follow",
  ogTitle = "",
  ogDescription = "",
  ogType = DEFAULT_OG_TYPE,
  ogUrl = "",
  ogImage = DEFAULT_IMAGE_PATH,
  ogImageAlt = DEFAULT_IMAGE_ALT,
  twitterCard = DEFAULT_TWITTER_CARD,
  twitterTitle = "",
  twitterDescription = "",
  twitterImage = DEFAULT_IMAGE_PATH,
  twitterImageAlt = DEFAULT_IMAGE_ALT,
  structuredData = [],
} = {}) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const canonicalUrl = buildCanonicalUrl(canonical);
    const normalizedDescription = truncateDescription(description, 180) || DEFAULT_DESCRIPTION;
    const resolvedOgTitle = ogTitle || title || DEFAULT_TITLE;
    const resolvedOgDescription = truncateDescription(ogDescription, 180) || normalizedDescription;
    const resolvedOgUrl = ogUrl || canonicalUrl;
    const resolvedOgImage = resolveSeoImage(ogImage || DEFAULT_IMAGE_PATH);
    const resolvedTwitterTitle = twitterTitle || title || DEFAULT_TITLE;
    const resolvedTwitterDescription =
      truncateDescription(twitterDescription, 180) || normalizedDescription;
    const resolvedTwitterImage = resolveSeoImage(twitterImage || DEFAULT_IMAGE_PATH);

    document.title = title || DEFAULT_TITLE;

    const descriptionTag = ensureMetaTag("name", "description");
    if (descriptionTag) {
      descriptionTag.setAttribute("content", normalizedDescription);
    }

    const robotsTag = ensureMetaTag("name", "robots");
    if (robotsTag) {
      robotsTag.setAttribute("content", robots || "index,follow");
    }

    const canonicalTag = ensureLinkTag("canonical");
    if (canonicalTag) {
      canonicalTag.setAttribute("href", canonicalUrl);
    }

    const ogSiteNameTag = ensureMetaTag("property", "og:site_name");
    if (ogSiteNameTag) {
      ogSiteNameTag.setAttribute("content", SITE_NAME);
    }

    const ogLocaleTag = ensureMetaTag("property", "og:locale");
    if (ogLocaleTag) {
      ogLocaleTag.setAttribute("content", "en_US");
    }

    const ogTitleTag = ensureMetaTag("property", "og:title");
    if (ogTitleTag) {
      ogTitleTag.setAttribute("content", resolvedOgTitle);
    }

    const ogDescriptionTag = ensureMetaTag("property", "og:description");
    if (ogDescriptionTag) {
      ogDescriptionTag.setAttribute("content", resolvedOgDescription);
    }

    const ogTypeTag = ensureMetaTag("property", "og:type");
    if (ogTypeTag) {
      ogTypeTag.setAttribute("content", ogType || DEFAULT_OG_TYPE);
    }

    const ogUrlTag = ensureMetaTag("property", "og:url");
    if (ogUrlTag) {
      ogUrlTag.setAttribute("content", resolvedOgUrl);
    }

    const ogImageTag = ensureMetaTag("property", "og:image");
    if (ogImageTag) {
      ogImageTag.setAttribute("content", resolvedOgImage);
    }

    const ogImageAltTag = ensureMetaTag("property", "og:image:alt");
    if (ogImageAltTag) {
      ogImageAltTag.setAttribute("content", ogImageAlt || DEFAULT_IMAGE_ALT);
    }

    const twitterCardTag = ensureMetaTag("name", "twitter:card");
    if (twitterCardTag) {
      twitterCardTag.setAttribute("content", twitterCard || DEFAULT_TWITTER_CARD);
    }

    const twitterTitleTag = ensureMetaTag("name", "twitter:title");
    if (twitterTitleTag) {
      twitterTitleTag.setAttribute("content", resolvedTwitterTitle);
    }

    const twitterDescriptionTag = ensureMetaTag("name", "twitter:description");
    if (twitterDescriptionTag) {
      twitterDescriptionTag.setAttribute("content", resolvedTwitterDescription);
    }

    const twitterImageTag = ensureMetaTag("name", "twitter:image");
    if (twitterImageTag) {
      twitterImageTag.setAttribute("content", resolvedTwitterImage);
    }

    const twitterImageAltTag = ensureMetaTag("name", "twitter:image:alt");
    if (twitterImageAltTag) {
      twitterImageAltTag.setAttribute("content", twitterImageAlt || DEFAULT_IMAGE_ALT);
    }

    const validStructuredData = Array.isArray(structuredData)
      ? structuredData.filter(Boolean)
      : [];
    const script = ensureStructuredDataScript();
    if (script) {
      if (validStructuredData.length > 0) {
        script.textContent = serializeJsonLd(
          validStructuredData.length === 1 ? validStructuredData[0] : validStructuredData
        );
      } else {
        script.textContent = "";
      }
    }

    return undefined;
  }, [
    canonical,
    description,
    ogDescription,
    ogImage,
    ogImageAlt,
    ogTitle,
    ogType,
    ogUrl,
    robots,
    structuredData,
    title,
    twitterCard,
    twitterDescription,
    twitterImage,
    twitterImageAlt,
    twitterTitle,
  ]);

  return null;
}
