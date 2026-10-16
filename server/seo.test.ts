import { describe, it, expect } from "vitest";
import { ROBOTS_TXT, LLMS_TXT, sitemapXml } from "./_core/seo";

describe("seo files", () => {
  it("robots.txt points at sitemap", () => {
    expect(ROBOTS_TXT).toContain("Sitemap: https://treasury.bjunjo.com/sitemap.xml");
  });
  it("sitemap is valid xml with root url", () => {
    const x = sitemapXml("2026-10-16");
    expect(x.startsWith("<?xml")).toBe(true);
    expect(x).toContain("<loc>https://treasury.bjunjo.com/</loc>");
  });
  it("llms.txt has title", () => {
    expect(LLMS_TXT.startsWith("# BTC Treasury Intelligence")).toBe(true);
  });
});
