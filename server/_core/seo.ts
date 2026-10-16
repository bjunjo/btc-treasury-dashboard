import type { Express } from "express";

export const SITE_URL = "https://treasury.bjunjo.com";

export const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

export function sitemapXml(lastmod = new Date().toISOString().slice(0, 10)): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>
</urlset>
`;
}

export const LLMS_TXT = `# BTC Treasury Intelligence

> Live dashboard of public companies holding Bitcoin as a treasury asset: BTC holdings, BTC per share, mNAV (enterprise value / BTC NAV, including debt and preferreds), debt coverage, and exchange disclosures.

Companies tracked: Strategy (MSTR), Metaplanet (3350.T), Nakamoto (NAKA), The Smarter Web Company (SWC.L), H100 Group (HOGPF).

## Data
- [Dashboard](${SITE_URL}/): human-readable live dashboard
- [JSON API](${SITE_URL}/api/trpc/treasury.getData): machine-readable data (tRPC; payload under result.data.json)

## Sources
Primary sources: strategy.com API, SEC EDGAR, TDnet / metaplanet.jp, London Stock Exchange, MFN (H100). Each value carries a confidence flag (LIVE / FALLBACK / HARDCODED). Not investment advice.
`;

export function registerSeoRoutes(app: Express): void {
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(ROBOTS_TXT);
  });
  app.get("/sitemap.xml", (_req, res) => {
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(sitemapXml());
  });
  app.get("/llms.txt", (_req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(LLMS_TXT);
  });
}
