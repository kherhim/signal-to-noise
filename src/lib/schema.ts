/* Shared schema.org identity for the site's JSON-LD, plus the small helpers
   that build it. One Person, one WebSite: every page points back at them
   by @id rather than repeating the details. */

export const SITE_URL = 'https://signal-to-noise.co';

/* LinkedIn handle, shared with the contact page. */
export const LINKEDIN_HANDLE = 'hkher';

export const AUTHOR = {
  '@type': 'Person',
  '@id': `${SITE_URL}/about/#person`,
  name: 'Himanshu Kher',
  url: `${SITE_URL}/about/`,
  image: `${SITE_URL}/img/himanshu-portrait.webp`,
  jobTitle: 'Chief Financial Officer',
  sameAs: [
    `https://www.linkedin.com/in/${LINKEDIN_HANDLE}/`,
    'https://www.linkedin.com/newsletters/signal-to-noise-7490249039209271296/',
    'https://hkher.substack.com',
  ],
  knowsAbout: [
    'Corporate finance',
    'FP&A',
    'Capital allocation',
    'Artificial intelligence',
    'Capital markets',
  ],
} as const;

export const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'Signal to Noise',
  alternateName: 'Signal to Noise by Himanshu Kher',
  url: `${SITE_URL}/`,
  publisher: { '@id': AUTHOR['@id'] },
  author: { '@id': AUTHOR['@id'] },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
} as const;

/* Crawlers get the JPEG twin from /og/, not the on-page WebP: LinkedIn's
   preview crawler does not reliably render WebP. scripts/make-og-images.mjs
   generates these. Pages with no cover fall back to the default card. */
export function ogImagePath(coverImage?: string): string {
  return coverImage
    ? coverImage.replace(/^\/img\//, '/og/').replace(/\.webp$/, '.jpg')
    : '/og/default.jpg';
}

/* JSON for a <script type="application/ld+json"> body. Escaping '<' stops
   essay text such as "</script>" from closing the tag early. */
export function serialiseJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
