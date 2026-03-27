# BTC Treasury Intelligence

**A personal, open-source dashboard for tracking companies that hold Bitcoin on their balance sheet.**

Live at → [billy-treasury.manus.space](https://billy-treasury.manus.space)

---

## Why This Exists

I started building this because I couldn't find a single place that showed me everything I actually wanted to know about Bitcoin treasury companies — not just how much BTC they hold, but *how efficiently* they hold it relative to their equity value, what their debt exposure looks like, and what they're disclosing to regulators right now.

Most existing trackers are either too simple (just a BTC count) or too opaque about where their numbers come from. I wanted something that:

- Shows **mNAV** (market-implied premium over BTC NAV) as the primary lens, not just raw BTC count
- Sources data from **legally authoritative filings** wherever possible — SEC EDGAR, TDnet, LSE, MFN — not just scraped news
- Is **conservative** on market cap: I use Basic Shares Outstanding (the actual shares in circulation) rather than inflated fully-diluted counts that include out-of-the-money options
- Is **transparent** about what's live vs. what's a hardcoded fallback

This is my personal watchlist. If it's useful to you, fork it.

---

## Companies Tracked

| # | Company | Ticker | Exchange | Country |
|---|---------|--------|----------|---------|
| 1 | Strategy | MSTR | Nasdaq | 🇺🇸 USA |
| 2 | Metaplanet | 3350.T | TSE (Tokyo) | 🇯🇵 Japan |
| 3 | Nakamoto Inc. | NAKA | Nasdaq | 🇺🇸 USA |
| 4 | Smarter Web Co. | SWC.L | LSE AIM | 🇬🇧 UK |
| 5 | H100 Group | HOGPF | Nasdaq First North | 🇸🇪 Sweden |

**On the radar (not yet added):**

| Company | Ticker | Exchange | Country | BTC Held | Notes |
|---------|--------|----------|---------|----------|---------|
| Capital B | ALCPB.PA / CPTLF | Euronext Paris (Alternext) / OTC US | 🇫🇷 France | ~2,888 BTC | Europe's first Bitcoin treasury company; formerly The Blockchain Group. ~229.7M shares. |
| OranjeBTC | OBTC3 | B3 (Bovespa) | 🇧🇷 Brazil | ~3,708 BTC | First publicly-traded Bitcoin treasury company in Latin America; listed Oct 2025. ~168.6M shares. |

These are companies I'm watching and expect to add as their data sources and disclosure cadence mature.

---

## Metrics Explained

### mNAV (Modified Net Asset Value multiple)

> mNAV = Enterprise Value ÷ BTC Treasury Value

This is the core metric. It tells you how much premium (or discount) the market is pricing in over the company's raw Bitcoin holdings. A value of 1.0x means the market values the company exactly at its BTC. Above 1.0x means you're paying a premium for the equity wrapper — which may be justified by leverage, future accumulation capacity, or the "Bitcoin treasury" brand.

For Strategy (MSTR), the Enterprise Value is sourced directly from the `strategy.com` official API (`mstrKpiData` endpoint), which reflects their own calculation using Basic Shares Outstanding. For other companies, EV is computed as: `FD Market Cap + Net Debt`.

### Market Cap

Market cap is displayed in **Billions USD** to two decimal places (e.g. `$45.94B`, `$0.21B`). For MSTR, this is the live value from strategy.com's API — which uses Basic Shares Outstanding × price, matching what Bloomberg and companiesmarketcap.com report. For other companies, it is computed as `Price × Fully Diluted Shares`.

**Why the distinction matters:** Strategy has issued multiple tranches of convertible notes (2028–2032), preferred stock (STRK, STRF), and ATM equity offerings. The difference between Basic (~345M shares) and Assumed Diluted (~378M shares) is meaningful. I use Basic for market cap because that's what the market actually prices — but I note the FD label where applicable.

### BTC/Share (in satoshis)

How many satoshis of Bitcoin exposure you get per share of equity. Useful for comparing accumulation efficiency across companies of different sizes. 1 BTC = 100,000,000 satoshis.

### Risk Label

Based on BTC treasury coverage of total debt:

| Label | Coverage |
|-------|----------|
| `LOW` | BTC treasury > 2× debt |
| `MOD` | 1× – 2× debt |
| `HIGH` | 0.5× – 1× debt |
| `CRIT` | < 0.5× debt |
| `NONE` | No debt |

---

## Data Sources

The data layer follows a strict source hierarchy — **authoritative sources first, fallback last**. This is the same principle used by Bloomberg Terminal and FactSet: always prefer the company's own regulatory filings over third-party aggregators.

| Tier | Source | Used For |
|------|--------|----------|
| 0 | [strategy.com API](https://api.strategy.com/btc/mstrKpiData) | MSTR market cap, EV, debt, preferred, BTC holdings |
| 0 | [SEC EDGAR](https://www.sec.gov/cgi-bin/browse-edgar) | MSTR & NAKA 8-K filings (BTC purchase disclosures) |
| 0 | [MFN RSS](https://mfn.se) | H100 Group press releases (Nasdaq First North) |
| 1 | [TDnet](https://www.release.tdnet.info) | Metaplanet TSE disclosures |
| 1 | [LSE alldata](https://www.londonstockexchange.com) | Smarter Web Co. RNS filings |
| 2 | [Yahoo Finance](https://finance.yahoo.com) | Stock prices, FX rates (USD/KRW, USD/JPY, GBP/USD, USD/SEK) |
| 2 | [CoinGecko](https://www.coingecko.com) | BTC/USD price |
| 2 | [Upbit](https://upbit.com) | BTC/KRW price (for Kimchi premium) |
| 3 | Hardcoded | Last-known-good fallback when APIs are unavailable |

Disclosure data (SEC EDGAR, TDnet, LSE, MFN) is fetched fresh on every request. Price data is cached for 5 minutes to avoid rate-limiting.

---

## Architecture

```
server/treasury.ts     ← All data fetching, computation, caching
server/routers.ts      ← tRPC procedures (treasury.getData)
client/src/pages/Home.tsx  ← Dashboard UI
```

**Stack:** React 19 + Tailwind 4 + tRPC 11 + Express 4. No database required — all data is fetched live from public APIs and cached in memory.

**Key design decisions:**

- **No database for market data.** Everything is fetched fresh and cached in-process. This keeps the deployment simple and ensures data is never stale beyond the TTL.
- **Parallel fetching.** All API calls within a refresh cycle run concurrently via `Promise.allSettled`, so a single slow source doesn't block the others.
- **Graceful degradation.** Every data point has a hardcoded fallback. If strategy.com is down, the dashboard still loads with the last known values.
- **First-principles computation.** mNAV, BTC coverage, and BTC/share are computed from raw inputs — not scraped from aggregators. This means I can audit every number back to its source.

---

## Known Limitations & Future Work

- **Debt data for non-MSTR companies** is partially hardcoded and needs more rigorous sourcing (e.g., from annual reports or exchange filings). HVAC-related debt structures and off-balance-sheet items are not yet reflected.
- **Fully diluted shares** for non-MSTR companies come from the most recent public filings and are updated manually. Automated live fetching from Yahoo Finance's `sharesOutstanding` field is planned.
- **BTC/Share** for MSTR still uses a hardcoded share count (254M) rather than the live implied count from the API. This will be fixed in a future update.
- **Planned additions:** Méliuz (Brazil), CapitalBee (France), and any other companies that establish meaningful BTC treasury positions.

---

## Running Locally

```bash
# Clone
git clone https://github.com/bjunjo/btc-treasury-dashboard.git
cd btc-treasury-dashboard

# Install
pnpm install

# Run dev server
pnpm dev
```

No API keys required. All data sources used are public.

---

## Disclaimer

For personal informational use only. This dashboard is a private research tool and does not constitute financial advice, investment advice, trading advice, or any other form of advice. All data is sourced from third-party APIs and public filings and may be delayed, inaccurate, or incomplete. The creator accepts no liability for decisions made based on this information.

---

## License

MIT — fork it, use it, improve it.
