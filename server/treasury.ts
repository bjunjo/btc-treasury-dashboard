/**
 * treasury.ts — Bitcoin Treasury Intelligence Data Layer
 *
 * Data sources (tiered by legal authority):
 *   Tier 0: Official exchange APIs (SEC EDGAR, MFN RSS, strategy.com)
 *   Tier 1: Official exchange scrapers (TDnet, LSE alldata)
 *   Tier 2: Yahoo Finance JSON (prices, FX rates)
 *   Tier 3: Hardcoded last-known-good values
 *
 * Cache: 5-minute TTL to avoid hammering APIs
 */

import axios from "axios";
import { parse as parseHtml } from "node-html-parser";
import { invokeLLM } from "./_core/llm";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FxRates {
  usdKrw: number;
  usdJpy: number;
  gbpUsd: number;
  usdSek: number;
}

export interface BtcPrice {
  usd: number;
  krwUpbit: number | null;
  change24h: number;
  kimchiPremium: number | null;
}

export interface CompanyData {
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  flag: string;
  priceUsd: number | null;
  priceLocal: number | null;
  localCurrency: string;
  change24h: number | null;
  btcHeld: number;
  sharesDiluted: number;
  debtUsd: number;
  cashUsd: number;
  btcPerShare: number | null;
  btcPerShareSats: number | null;
  mNavEv: number | null;
  btcCoverage: number | null;
  riskLabel: "LOW" | "MOD" | "HIGH" | "CRIT" | "NONE";
  fdMarketCapUsd: number | null;
  btcTreasuryUsd: number | null;
  netDebtUsd: number;
  priceConfidence: "LIVE" | "FALLBACK" | "HARDCODED";
  btcConfidence: "LIVE" | "FALLBACK" | "HARDCODED";
}

export interface Disclosure {
  company: string;
  exchange: string;
  date: string;
  title: string;
  isBtc: boolean;
  isInsideInfo: boolean;
  pdfUrl: string | null;
  source: string;
  url: string | null;
}

export interface TreasuryData {
  btc: BtcPrice;
  fx: FxRates;
  companies: CompanyData[];
  disclosures: Disclosure[];
  lastUpdated: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let _cache: { data: TreasuryData; ts: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — BTC holdings change weekly at most; prices tolerate 30min lag

// ── Hardcoded fallback data ──────────────────────────────────────────────────

const HARDCODED: Record<string, { btc: number; sharesDiluted: number; debtUsd: number; cashUsd: number }> = {
  // Strategy: 762,099 BTC (Mar 27 2026, bitbo.io); ~254M basic shares; BTC & debt live-fetched from strategy.com API
  MSTR:   { btc: 762_099,  sharesDiluted: 254_000_000,  debtUsd: 8_190_155_000, cashUsd: 57_000_000 },
  // Metaplanet: 35,102 BTC (FY2025 audited, Dec 31 2025); 1,166,776,726 shares (Feb 28 2026 TSE filing)
  "3350.T": { btc: 35_102,   sharesDiluted: 1_166_776_726, debtUsd: 275_000_000,   cashUsd: 5_000_000 },
  // H100 Group: 1,051 BTC (post-balance-sheet, Q4 2025 report filed 2026-02-24);
  //   Debt: SEK 75,480,378 convertible bond liability component (IFRS split: ~70M SEK debt / ~150M SEK equity)
  //   Source: Condensed consolidated statement of financial position, Q4 2025 Full-Year Report
  //   SEK/USD ~0.0944 (Mar 2026); update debt when next quarterly report is filed
  HOGPF:  { btc: 1_051,    sharesDiluted: 335_250_237,  debtUsd: 7_125_348,     cashUsd: 0 },
  // Smarter Web Company: 2,689 BTC (Oct 31 2025 annual report); 398,869,927 shares;
  //   Debt: £10,957,578 Smarter Convert CLN (1-yr note, matures ~Aug 2026, carried at FVTPL net of Day 1 loss)
  //   Source: Note 24, Annual Report 2025 (year-end Oct 31 2025, filed 2026-02-19)
  //   GBP/USD ~1.295 (Mar 2026); update when next annual report is filed (Oct 2026)
  "SWC.L":  { btc: 2_689,    sharesDiluted: 398_869_927,  debtUsd: 14_190_564,    cashUsd: 615_218 },
  // Nakamoto Inc.: 5,342 BTC (Dec 31 2025, Q4 earnings press release filed 2026-03-30)
  // Fully diluted shares: 892,723,518 as of Mar 27 2026 (common 690,018,254 + options 78,714,493 + pre-funded warrants 61,704,975 + holdback shares 27,483,604 + RSUs 17,636,822 + letters of transmittal 16,678,652 + cash warrants 486,718)
  // Source: Nakamoto Inc. Exhibit 99.1, SEC EDGAR, filed 2026-03-30
  NAKA:   { btc: 5_342,    sharesDiluted: 892_723_518,  debtUsd: 214_859_489,   cashUsd: 24_185_083 },
};

const COMPANY_META: Record<string, { name: string; exchange: string; country: string; flag: string; localCurrency: string }> = {
  MSTR:     { name: "Strategy",         exchange: "Nasdaq",             country: "USA",    flag: "🇺🇸", localCurrency: "USD" },
  "3350.T": { name: "Metaplanet",       exchange: "TSE",                country: "Japan",  flag: "🇯🇵", localCurrency: "JPY" },
  HOGPF:    { name: "H100 Group",       exchange: "Nasdaq First North", country: "Sweden", flag: "🇸🇪", localCurrency: "SEK" },
  "SWC.L":  { name: "Smarter Web Co.", exchange: "LSE AIM",            country: "UK",     flag: "🇬🇧", localCurrency: "GBp" },
  NAKA:     { name: "Nakamoto Inc.",    exchange: "Nasdaq",             country: "USA",    flag: "🇺🇸", localCurrency: "USD" },
};

const TICKER_ORDER = ["MSTR", "3350.T", "NAKA", "SWC.L", "HOGPF"];

// ── FX Rates ─────────────────────────────────────────────────────────────────

async function fetchFxRate(symbol: string): Promise<number | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    return res.data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function fetchFxRates(): Promise<FxRates> {
  const fallback: FxRates = { usdKrw: 1350, usdJpy: 150, gbpUsd: 1.27, usdSek: 10.5 };
  try {
    const [krwUsd, jpyUsd, gbpUsd, sekUsd] = await Promise.all([
      fetchFxRate("KRWUSD=X"),
      fetchFxRate("JPYUSD=X"),
      fetchFxRate("GBPUSD=X"),
      fetchFxRate("SEKUSD=X"),
    ]);
    return {
      usdKrw: krwUsd ? 1 / krwUsd : fallback.usdKrw,
      usdJpy: jpyUsd ? 1 / jpyUsd : fallback.usdJpy,
      gbpUsd: gbpUsd ?? fallback.gbpUsd,
      usdSek: sekUsd ? 1 / sekUsd : fallback.usdSek,
    };
  } catch {
    return fallback;
  }
}

// ── BTC Price ─────────────────────────────────────────────────────────────────

async function fetchBtcPrice(fx: FxRates): Promise<BtcPrice> {
  let usd = 68000;
  let change24h = 0;
  let krwRef = usd * fx.usdKrw;
  let krwUpbit: number | null = null;
  let kimchiPremium: number | null = null;

  try {
    const res = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw&include_24hr_change=true",
      { timeout: 8000 }
    );
    const data = res.data.bitcoin;
    usd = data.usd;
    change24h = data.usd_24h_change ?? 0;
    krwRef = data.krw;
  } catch {
    // use fallback
  }

  try {
    const upbit = await axios.get(
      "https://api.upbit.com/v1/ticker?markets=KRW-BTC",
      { timeout: 6000, headers: { Accept: "application/json" } }
    );
    krwUpbit = upbit.data[0]?.trade_price ?? null;
    if (krwUpbit && krwRef) {
      kimchiPremium = ((krwUpbit - krwRef) / krwRef) * 100;
    }
  } catch {
    // upbit optional
  }

  return { usd, krwUpbit, change24h, kimchiPremium };
}

// ── Stock Prices ──────────────────────────────────────────────────────────────

async function fetchStockPrice(ticker: string): Promise<{ price: number; change: number; currency: string } | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    const meta = res.data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, change, currency: meta.currency ?? "USD" };
  } catch {
    return null;
  }
}

async function fetchStockPrices(tickers: string[]): Promise<Record<string, { price: number; change: number; currency: string }>> {
  const results = await Promise.allSettled(tickers.map(t => fetchStockPrice(t)));
  const result: Record<string, { price: number; change: number; currency: string }> = {};
  for (let i = 0; i < tickers.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      result[tickers[i]!] = r.value;
    }
  }
  return result;
}

// ── MSTR live data from strategy.com API ────────────────────────────────────
// Source hierarchy (world-class standard):
//   Tier 0: strategy.com official API  — authoritative, updated every market close
//   Tier 1: Hardcoded fallback         — last known good values
//
// mstrKpiData endpoint returns:
//   marketCap (millions USD) — Basic shares × price, updated daily by strategy.com
//   entVal    (millions USD) — Enterprise Value = Market Cap + Debt + Preferred − Cash
//   debt      (millions USD) — total debt
//   pref      (millions USD) — preferred stock (STRK + STRF)
//
// bitcoinKpis endpoint returns:
//   btcHoldings — live BTC count
//   debtPrefByBN — (debt+pref) as % of BTC NAV (used only as cross-check)

interface MstrLiveData {
  btcHeld: number;
  marketCapUsd: number | null;   // live from mstrKpiData
  evUsd: number | null;          // live enterprise value from mstrKpiData
  debtUsd: number;
  prefUsd: number;               // preferred stock value
  cashUsd: number;
}

async function fetchMstrLiveData(): Promise<MstrLiveData> {
  const fallback: MstrLiveData = {
    btcHeld: HARDCODED.MSTR.btc,
    marketCapUsd: null,
    evUsd: null,
    debtUsd: HARDCODED.MSTR.debtUsd,
    prefUsd: 0,
    cashUsd: HARDCODED.MSTR.cashUsd,
  };

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Origin": "https://www.strategy.com",
    "Referer": "https://www.strategy.com/",
  };

  try {
    // Fetch both endpoints in parallel
    const [kpisRes, mstrRes] = await Promise.allSettled([
      axios.get("https://api.strategy.com/btc/bitcoinKpis", { timeout: 8000, headers }),
      axios.get("https://api.strategy.com/btc/mstrKpiData", { timeout: 8000, headers }),
    ]);

    // Parse BTC holdings from bitcoinKpis
    let btcHeld = HARDCODED.MSTR.btc;
    if (kpisRes.status === "fulfilled") {
      const r = kpisRes.value.data?.results ?? {};
      const parsed = parseInt(String(r.btcHoldings ?? "").replace(/,/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) btcHeld = parsed;
    }

    // Parse market cap, EV, debt, preferred from mstrKpiData
    // All values are in millions USD as formatted strings (e.g. "45,940")
    let marketCapUsd: number | null = null;
    let evUsd: number | null = null;
    let debtUsd = HARDCODED.MSTR.debtUsd;
    let prefUsd = 0;
    if (mstrRes.status === "fulfilled") {
      const row = Array.isArray(mstrRes.value.data) ? mstrRes.value.data[0] : null;
      if (row) {
        const parseMil = (s: string | undefined) =>
          s ? parseFloat(s.replace(/,/g, "")) * 1_000_000 : null;
        const mc = parseMil(row.marketCap);
        const ev = parseMil(row.entVal);
        const debt = parseMil(row.debt);
        const pref = parseMil(row.pref);
        if (mc && mc > 0) marketCapUsd = mc;
        if (ev && ev > 0) evUsd = ev;
        if (debt && debt > 0) debtUsd = debt;
        if (pref && pref > 0) prefUsd = pref;
      }
    }

    return { btcHeld, marketCapUsd, evUsd, debtUsd, prefUsd, cashUsd: 0 };
  } catch {
    return fallback;
  }
}

// ── Japanese → English translation (for TDnet titles) ───────────────────────

const _titleCache: Map<string, string> = new Map();

async function translateJapanese(title: string): Promise<string> {
  // If already ASCII/Latin, skip translation
  if (!/[\u3000-\u9FFF\uF900-\uFAFF]/.test(title)) return title;
  if (_titleCache.has(title)) return _titleCache.get(title)!;
  try {
    const res = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a financial disclosure translator. Translate the Japanese text to concise English (max 12 words). Return ONLY the English translation, no explanation.",
        },
        { role: "user", content: title },
      ],
    });
    const raw = res.choices?.[0]?.message?.content;
    const translated = (typeof raw === "string" ? raw.trim() : null) ?? title;
    _titleCache.set(title, translated);
    return translated;
  } catch {
    return title;
  }
}

// ── TDnet Disclosures (Metaplanet) ────────────────────────────────────────────

async function fetchTdnetDisclosures(): Promise<Disclosure[]> {
  const disclosures: Disclosure[] = [];
  try {
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
      const url = `https://www.release.tdnet.info/inbs/I_list_001_${dateStr}.html`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { "User-Agent": "Mozilla/5.0", "Accept-Charset": "utf-8" },
        responseType: "arraybuffer",
      });
      const html = new TextDecoder("utf-8").decode(res.data);
      const root = parseHtml(html);
      const rows = root.querySelectorAll("tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 5) continue;
        const codeCell = cells.find(c => c.text.trim() === "33500" || c.text.trim() === "3350");
        if (!codeCell) continue;
        const timeCell = cells[0]?.text.trim() ?? "";
        const titleCell = cells.find(c => c.querySelector("a"));
        const title = titleCell?.text.trim() ?? "";
        const pdfHref = titleCell?.querySelector("a")?.getAttribute("href") ?? null;
        const pdfUrl = pdfHref ? `https://www.release.tdnet.info/inbs/${pdfHref.replace(/^\.\//, "")}` : null;
        const isBtc = /bitcoin|btc|ビットコイン|BTC/i.test(title);
        const titleEn = await translateJapanese(title);
        disclosures.push({
          company: "Metaplanet",
          exchange: "TSE / TDnet",
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)} ${timeCell}`,
          title: titleEn,
          isBtc,
          isInsideInfo: false,
          pdfUrl,
          source: "Tier1-TDnet",
          url: `https://www.release.tdnet.info/inbs/I_list_001_${dateStr}.html`,
        });
      }
      if (disclosures.length > 0) break;
    }
  } catch {
    // silent fail
  }
  return disclosures;
}

// ── LSE alldata API (SWC) ─────────────────────────────────────────────────────

async function fetchLseDisclosure(): Promise<Disclosure | null> {
  try {
    const res = await axios.get(
      "https://api.londonstockexchange.com/api/gw/lse/instruments/alldata/SWC",
      {
        timeout: 8000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
          "Accept-Language": "en-GB",
        },
      }
    );
    const d = res.data;
    const headline = d.subjectnews ?? d.latestNews ?? null;
    const date = d.datepreviousnews ?? d.dateNews ?? null;
    if (!headline) return null;
    const isBtc = /bitcoin|btc/i.test(headline);
    return {
      company: "Smarter Web Co.",
      exchange: "LSE / RNS",
      date: date ? String(date).slice(0, 22) : "—",
      title: headline,
      isBtc,
      isInsideInfo: false,
      pdfUrl: null,
      source: "Tier1-LSE-alldata",
      url: "https://www.londonstockexchange.com/stock/SWC/the-smarter-web-company-plc/company-page",
    };
  } catch {
    return null;
  }
}

// ── MFN RSS (H100) ────────────────────────────────────────────────────────────

async function fetchMfnDisclosures(): Promise<Disclosure[]> {
  const disclosures: Disclosure[] = [];
  try {
    const res = await axios.get("https://mfn.se/all/a/h100-group.rss", {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/rss+xml" },
    });
    const raw: string = res.data;

    // node-html-parser treats <link> as void/self-closing, so use regex on raw XML
    const itemBlocks = raw.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of itemBlocks.slice(0, 10)) {
      const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
                     block.match(/<title>([^<]*)<\/title>/))?.[1]?.trim() ?? "";
      const pubDate = (block.match(/<pubDate>([^<]*)<\/pubDate>/))?.[1]?.trim() ?? "";
      // <link> in RSS is plain text between tags (not self-closing)
      const link = (block.match(/<link>([^<]+)<\/link>/) ??
                    block.match(/<guid[^>]*>([^<]+)<\/guid>/))?.[1]?.trim() ?? null;
      const tagMatches = Array.from(block.matchAll(/<x:tag>([^<]*)<\/x:tag>/g)).map(m => m[1]!.toLowerCase());
      const isInsideInfo = tagMatches.some(t => t.includes("inside-information"));
      const isBtc = /bitcoin|btc/i.test(title);
      if (!isBtc) continue;
      disclosures.push({
        company: "H100 Group",
        exchange: "Nasdaq First North / MFN",
        date: pubDate.slice(0, 22),
        title,
        isBtc: true,
        isInsideInfo,
        pdfUrl: null,
        source: "Tier0-MFN-RSS",
        url: link,
      });
    }
  } catch {
    // silent fail
  }
  return disclosures;
}

// ── SEC EDGAR Disclosures (Strategy + Nakamoto) ────────────────────────────────────────

// Map of SEC 8-K item codes to human-readable descriptions
const EDGAR_ITEM_LABELS: Record<string, string> = {
  "1.01": "Entry into Material Agreement",
  "1.02": "Termination of Material Agreement",
  "2.01": "Completion of Acquisition or Disposition",
  "2.02": "Results of Operations (Earnings)",
  "2.03": "Creation of Direct Financial Obligation",
  "3.02": "Unregistered Sales of Equity Securities",
  "5.02": "Departure/Appointment of Directors or Officers",
  "5.03": "Amendments to Articles of Incorporation",
  "7.01": "Regulation FD Disclosure",
  "8.01": "Other Events",
  "9.01": "Financial Statements and Exhibits",
};

function edgarItemsToTitle(items: string, company: string): string {
  const codes = items.split(",").map(s => s.trim()).filter(Boolean);
  // BTC purchase filings for Strategy are always 8.01 + 7.01
  const isBtcPurchase = codes.includes("8.01") && (codes.includes("7.01") || codes.includes("9.01"));
  if (isBtcPurchase && company === "Strategy") return "Bitcoin Purchase Disclosure";
  // Pick the most descriptive item (exclude 9.01 which is just exhibits)
  const meaningful = codes.filter(c => c !== "9.01");
  if (meaningful.length === 0) return "SEC Filing (8-K)";
  const primary = meaningful[0]!;
  return EDGAR_ITEM_LABELS[primary] ?? `SEC 8-K (Item ${primary})`;
}

async function fetchSecEdgarDisclosures(
  company: string,
  cik: string,
  exchange: string
): Promise<Disclosure[]> {
  const disclosures: Disclosure[] = [];
  try {
    const res = await axios.get(
      `https://data.sec.gov/submissions/${cik}.json`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "btc-treasury-dashboard contact@example.com",
          Accept: "application/json",
        },
      }
    );
    const recent = res.data?.filings?.recent ?? {};
    const forms: string[] = recent.form ?? [];
    const dates: string[] = recent.filingDate ?? [];
    const accessions: string[] = recent.accessionNumber ?? [];
    const items: string[] = recent.items ?? [];
    const docs: string[] = recent.primaryDocument ?? [];
    const cikNum = cik.replace("CIK", "").replace(/^0+/, "");

    let count = 0;
    for (let i = 0; i < forms.length && count < 5; i++) {
      if (forms[i] !== "8-K") continue;
      const acc = accessions[i]!;
      const date = dates[i]!;
      const itemStr = items[i] ?? "";
      const doc = docs[i] ?? "";
      const accClean = acc.replace(/-/g, "");
      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${doc}`;
      const title = edgarItemsToTitle(itemStr, company);
      const isBtc = /bitcoin|btc/i.test(title) || (company === "Strategy" && itemStr.includes("8.01"));
      disclosures.push({
        company,
        exchange,
        date,
        title,
        isBtc,
        isInsideInfo: false,
        pdfUrl: null,
        source: "Tier0-SEC-EDGAR",
        url,
      });
      count++;
    }
  } catch {
    // silent fail
  }
  return disclosures;
}

// ── StrategyTracker live data (Metaplanet, H100, SWC) ───────────────────────────────────────────
//
// data.strategytracker.com is the official partner data feed for all three companies.
// Metaplanet, H100, and Smarter Web Company submit their BTC holdings directly to
// StrategyTracker as verified partners. This is the most timely structured source
// available for non-US companies without a paid regulatory API subscription.
//
// The feed updates within hours of each company's official disclosure.

interface StrategyTrackerEntry {
  btc: number;
  sharesOutstanding: number;
  marketCap: number;
  satsPerShare: number;
  navPremium: number;
}

type StrategyTrackerMap = Record<string, StrategyTrackerEntry>;

let _stCache: { data: StrategyTrackerMap; ts: number } | null = null;
const ST_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchStrategyTrackerData(): Promise<StrategyTrackerMap> {
  if (_stCache && Date.now() - _stCache.ts < ST_CACHE_TTL_MS) {
    return _stCache.data;
  }
  try {
    // Step 1: get the current versioned filename
    const latestRes = await axios.get("https://data.strategytracker.com/latest.json", {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    // Step 2: fetch the full data file (has latestTotalShares, latestBtcBalance, processedMetrics)
    const fullFile: string = latestRes.data?.files?.full;
    if (!fullFile) return {};
    const dataRes = await axios.get(`https://data.strategytracker.com/${fullFile}`, {
      timeout: 20000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    const companies = dataRes.data?.companies ?? {};

    // Map to our internal format — keyed by our internal tickers
    const result: StrategyTrackerMap = {};
    const tickerMap: Record<string, string> = {
      "3350.T": "3350.T",
      "H100":   "HOGPF",
      "SWC.AQ": "SWC.L",
    };
    for (const [stTicker, ourTicker] of Object.entries(tickerMap)) {
      const entry = companies[stTicker];
      if (!entry) continue;
      // processedMetrics has the most accurate per-company data
      const pm = entry.processedMetrics ?? entry;
      // latestBtcBalance is the most current BTC count (updated on each disclosure)
      const btc = typeof pm.latestBtcBalance === "number" && pm.latestBtcBalance > 0
        ? pm.latestBtcBalance
        : (typeof entry.holdings === "number" && entry.holdings > 0 ? entry.holdings : null);
      // latestTotalShares is the most current share count from official filings
      const shares = typeof pm.latestTotalShares === "number" && pm.latestTotalShares > 0
        ? pm.latestTotalShares
        : (typeof pm.sharesOutstanding === "number" && pm.sharesOutstanding > 0 ? pm.sharesOutstanding : null);
      // marketCapBasic = latestTotalShares (issued shares) × price — matches analytics.metaplanet.jp
      // currentMarketCap = sharesOutstanding (float only) × price — too low for Metaplanet
      const mc = typeof pm.marketCapBasic === "number" && pm.marketCapBasic > 0
        ? pm.marketCapBasic
        : (typeof pm.currentMarketCap === "number" && pm.currentMarketCap > 0
          ? pm.currentMarketCap
          : (typeof entry.marketCap === "number" && entry.marketCap > 0 ? entry.marketCap : null));
      const sats = typeof pm.shareCostSats === "number" ? pm.shareCostSats
        : (typeof entry.satsPerShare === "number" ? entry.satsPerShare : null);
      const nav = typeof pm.navPremiumBasic === "number" ? pm.navPremiumBasic
        : (typeof entry.navPremium === "number" ? entry.navPremium : null);
      if (btc && shares) {
        result[ourTicker] = {
          btc,
          sharesOutstanding: shares,
          marketCap: mc ?? 0,
          satsPerShare: sats ?? 0,
          navPremium: nav ?? 0,
        };
      }
    }

    _stCache = { data: result, ts: Date.now() };
    return result;
  } catch {
    return _stCache?.data ?? {};
  }
}

// ── SEC EDGAR — Nakamoto BTC holdings from S-3/8-K text ─────────────────────
// NAKA files BTC holdings in S-3 registration statements and 8-K press releases.
// These are more current than XBRL 10-Q (which lags 1-2 quarters).
// We scan the 10 most recent filings (any form) for a BTC holdings sentence.
async function fetchNakaBtcFromSecFilings(): Promise<{ btc: number | null; asOf: string | null }> {
  try {
    const subRes = await axios.get("https://data.sec.gov/submissions/CIK0001946573.json", {
      timeout: 10000,
      headers: { "User-Agent": "btc-treasury-dashboard contact@bjunjo.com", Accept: "application/json" },
    });
    const recent = subRes.data?.filings?.recent ?? {};
    const forms: string[] = recent.form ?? [];
    const dates: string[] = recent.filingDate ?? [];
    const accessions: string[] = recent.accessionNumber ?? [];
    const docs: string[] = recent.primaryDocument ?? [];

    // Scan last 15 filings for a BTC holdings number
    for (let i = 0; i < Math.min(15, forms.length); i++) {
      const acc = accessions[i]!.replace(/-/g, "");
      const doc = docs[i] ?? "";
      if (!doc.endsWith(".htm") && !doc.endsWith(".html")) continue;
      const url = `https://www.sec.gov/Archives/edgar/data/1946573/${acc}/${doc}`;
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { "User-Agent": "btc-treasury-dashboard contact@bjunjo.com" },
        });
        const text = (res.data as string).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        // Match patterns like "holds ~5,342 BTC", "5,398 bitcoin", "aggregate of 5,342 bitcoin"
        const m = text.match(/(?:holds?|holding|aggregate(?:\s+of)?|total(?:\s+of)?|approximately)\s*~?\s*([\d,]+)\s*(?:bitcoin|BTC)/i)
                ?? text.match(/([\d,]+)\s*(?:bitcoin|BTC)\s*(?:valued|held|in its treasury)/i);
        if (m) {
          const btc = parseFloat(m[1]!.replace(/,/g, ""));
          if (btc > 100 && btc < 100_000) {
            return { btc, asOf: dates[i] ?? null };
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* silent fail */ }
  return { btc: null, asOf: null };
}

// ── SEC EDGAR XBRL live data (Nakamoto Inc.) ─────────────────────────────────
//
// SEC EDGAR XBRL is the authoritative regulatory source for US public companies.
// Data reflects the most recently filed 10-Q or 10-K.
// Lag: typically 1-2 quarters behind real-time.
//
// Fields fetched:
//   CommonStockSharesOutstanding — diluted share count
//   CryptoAssetNumberOfUnits     — BTC held (ASC 350-60 standard)
//   LongTermDebt + NotesPayable  — total debt

interface EdgarXbrlData {
  shares: number | null;
  btc: number | null;
  debtUsd: number | null;
  asOf: string | null;
}

async function fetchNakaEdgarXbrl(): Promise<EdgarXbrlData> {
  const empty: EdgarXbrlData = { shares: null, btc: null, debtUsd: null, asOf: null };
  try {
    const res = await axios.get(
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0001946573.json",
      {
        timeout: 12000,
        headers: {
          "User-Agent": "btc-treasury-dashboard contact@bjunjo.com",
          Accept: "application/json",
        },
      }
    );
    const usGaap = res.data?.facts?.["us-gaap"] ?? {};

    const latestFiled = (key: string): { val: number; end: string } | null => {
      const units = usGaap[key]?.units ?? {};
      let best: { val: number; end: string } | null = null;
      for (const entries of Object.values(units) as Array<Array<{ val: number; end: string; form: string }>>) {
        for (const form of ["10-K", "10-Q", "10-K/A", "10-Q/A"]) {
          const matches = entries.filter(e => e.form === form);
          if (matches.length === 0) continue;
          matches.sort((a, b) => b.end.localeCompare(a.end));
          const top = matches[0]!;
          if (!best || top.end > best.end) best = { val: top.val, end: top.end };
          break;
        }
      }
      return best;
    }

    const sharesEntry = latestFiled("CommonStockSharesOutstanding");
    const btcEntry    = latestFiled("CryptoAssetNumberOfUnits");
    const debtEntry   = latestFiled("LongTermDebt") ?? latestFiled("NotesPayable");

    return {
      shares: sharesEntry?.val ?? null,
      btc:    btcEntry?.val ?? null,
      debtUsd: debtEntry?.val ?? null,
      asOf:   sharesEntry?.end ?? btcEntry?.end ?? null,
    };
  } catch {
    return empty;
  }
}

// ── Risk Label ──────────────────────────────────────────────────────────────────────────────────

function getRiskLabel(coverage: number | null, debtUsd: number): CompanyData["riskLabel"] {
  if (debtUsd === 0) return "NONE";
  if (coverage === null) return "NONE";
  if (coverage >= 5) return "LOW";
  if (coverage >= 2) return "MOD";
  if (coverage >= 1) return "HIGH";
  return "CRIT";
}

// ── Main Fetch ────────────────────────────────────────────────────────────────

export async function fetchTreasuryData(): Promise<TreasuryData> {
  // Return cached data if fresh
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  // Fetch all data in parallel
  const [fx, stockPrices, tdnetDisclosures, lseDisclosure, mfnDisclosures, mstrEdgarDisclosures, nakaEdgarDisclosures, strategyTrackerData, nakaXbrl, nakaSecFilings] = await Promise.all([
    fetchFxRates(),
    fetchStockPrices(TICKER_ORDER),
    fetchTdnetDisclosures(),
    fetchLseDisclosure(),
    fetchMfnDisclosures(),
    fetchSecEdgarDisclosures("Strategy", "CIK0001050446", "Nasdaq / SEC EDGAR"),
    fetchSecEdgarDisclosures("Nakamoto Inc.", "CIK0001946573", "Nasdaq / SEC EDGAR"),
    fetchStrategyTrackerData(),
    fetchNakaEdgarXbrl(),
    fetchNakaBtcFromSecFilings(),
  ]);

  const btc = await fetchBtcPrice(fx);

  // Convert local price to USD
  function toUsd(price: number, currency: string): number {
    if (currency === "USD") return price;
    if (currency === "JPY") return price / fx.usdJpy;
    if (currency === "GBp") return (price / 100) * fx.gbpUsd;
    if (currency === "GBP") return price * fx.gbpUsd;
    if (currency === "SEK") return price / fx.usdSek;
    if (currency === "KRW") return price / fx.usdKrw;
    return price;
  }

  // Build company data
  const companies: CompanyData[] = [];

  for (const ticker of TICKER_ORDER) {
    const meta = COMPANY_META[ticker]!;
    const hc = HARDCODED[ticker]!;
    const stock = stockPrices[ticker];

    let priceLocal = stock?.price ?? null;
    let priceUsd = priceLocal ? toUsd(priceLocal, stock?.currency ?? meta.localCurrency) : null;
    let change24h = stock?.change ?? null;
    const priceConfidence: CompanyData["priceConfidence"] = stock ? "LIVE" : "HARDCODED";

    // Live data overrides — tiered by source authority
    let debtUsd = hc.debtUsd;
    let cashUsd = hc.cashUsd;
    let liveBtcHeld = hc.btc;
    let liveSharesDiluted = hc.sharesDiluted;
    let liveMarketCapUsd: number | null = null;
    let liveEvUsd: number | null = null;
    let livePrefUsd = 0;
    let btcConfidence: CompanyData["btcConfidence"] = "HARDCODED";

    if (ticker === "MSTR") {
      // Strategy: official strategy.com API (most authoritative)
      const mstrLive = await fetchMstrLiveData();
      liveBtcHeld = mstrLive.btcHeld;
      debtUsd = mstrLive.debtUsd;
      cashUsd = mstrLive.cashUsd;
      liveMarketCapUsd = mstrLive.marketCapUsd;
      liveEvUsd = mstrLive.evUsd;
      livePrefUsd = mstrLive.prefUsd;
      btcConfidence = "LIVE";
    } else if (ticker === "3350.T" || ticker === "HOGPF" || ticker === "SWC.L") {
      // Metaplanet, H100, SWC: official StrategyTracker partner data feed
      const st = strategyTrackerData[ticker];
      if (st) {
        liveBtcHeld = st.btc;
        liveSharesDiluted = st.sharesOutstanding;
        liveMarketCapUsd = st.marketCap > 0 ? st.marketCap : null;
        btcConfidence = "LIVE";
      }
    } else if (ticker === "NAKA") {
      // Nakamoto: prefer SEC filing text (S-3/8-K) > XBRL 10-Q > hardcoded
      // SEC filing text is most current (updated on each S-3 or 8-K)
      if (nakaSecFilings.btc && nakaSecFilings.btc > 0) {
        liveBtcHeld = nakaSecFilings.btc;
        btcConfidence = "LIVE";
      } else if (nakaXbrl.btc && nakaXbrl.btc > 0) {
        liveBtcHeld = nakaXbrl.btc;
        btcConfidence = "LIVE";
      }
      if (nakaXbrl.shares && nakaXbrl.shares > 0) {
        liveSharesDiluted = nakaXbrl.shares;
      }
    }

    const btcHeld = liveBtcHeld;
    const sharesDiluted = liveSharesDiluted;
    const btcTreasuryUsd = btcHeld * btc.usd;
    const netDebtUsd = debtUsd - cashUsd;

    // Market cap: use live API value for MSTR (Basic shares × price from strategy.com),
    // fall back to Price × hardcoded FD shares for other companies.
    const fdMarketCapUsd = liveMarketCapUsd ?? (priceUsd && sharesDiluted ? priceUsd * sharesDiluted : null);

    const btcPerShare = sharesDiluted > 0 ? btcHeld / sharesDiluted : null;
    const btcPerShareSats = btcPerShare ? btcPerShare * 1e8 : null;

    // mNAV: use live EV from strategy.com API for MSTR (most accurate).
    // For others: EV = FD Market Cap + Net Debt (standard formula).
    let mNavEv: number | null = null;
    if (btcTreasuryUsd > 0) {
      const ev = liveEvUsd ?? (fdMarketCapUsd ? fdMarketCapUsd + netDebtUsd : null);
      if (ev) mNavEv = ev / btcTreasuryUsd;
    }

    const btcCoverage = debtUsd > 0 ? btcTreasuryUsd / debtUsd : null;
    const riskLabel = getRiskLabel(btcCoverage, debtUsd);

    companies.push({
      ticker,
      name: meta.name,
      exchange: meta.exchange,
      country: meta.country,
      flag: meta.flag,
      priceUsd,
      priceLocal,
      localCurrency: stock?.currency ?? meta.localCurrency,
      change24h,
      btcHeld,
      sharesDiluted,
      debtUsd,
      cashUsd,
      btcPerShare,
      btcPerShareSats,
      mNavEv,
      btcCoverage,
      riskLabel,
      fdMarketCapUsd,
      btcTreasuryUsd,
      netDebtUsd,
      priceConfidence,
      btcConfidence,
    });
  }

  // Sort by BTC held descending
  companies.sort((a, b) => b.btcHeld - a.btcHeld);

  // Assemble disclosures (sorted by date descending within each company)
  const disclosures: Disclosure[] = [
    ...mstrEdgarDisclosures,
    ...nakaEdgarDisclosures,
    ...tdnetDisclosures,
    ...(lseDisclosure ? [lseDisclosure] : []),
    ...mfnDisclosures,
  ];

  const data: TreasuryData = {
    btc,
    fx,
    companies,
    disclosures,
    lastUpdated: new Date().toISOString(),
  };

  _cache = { data, ts: Date.now() };
  return data;
}
