# BTC Treasury Intelligence Dashboard — TODO

## Backend API
- [x] tRPC router: `treasury.getData` — fetch BTC price, FX rates, treasury data, disclosures
- [x] Install axios, node-html-parser on server for scraping
- [x] CoinGecko API: BTC/USD price + 24h change
- [x] Upbit API: BTC/KRW (kimchi premium)
- [x] yfinance equivalent: stock prices via Yahoo Finance v8 chart API
- [x] FX rates: USD/KRW, USD/JPY, GBP/USD, USD/SEK via Yahoo Finance v8
- [x] Strategy.com API: MSTR debt (debtPrefByBN)
- [x] TDnet scraper: Metaplanet latest disclosures
- [x] LSE alldata API: SWC latest RNS
- [x] MFN RSS: H100 latest BTC disclosure
- [x] Treasury hardcoded data: BTC holdings, shares diluted, debt for all 5 companies (corrected Metaplanet to 1.14B shares, 35,102 BTC)
- [x] Cache layer: 5-minute TTL to avoid hammering APIs

## Frontend
- [x] Dark theme setup (Terminal Noir): OKLCH dark bg, BTC orange accent
- [x] Google Fonts: JetBrains Mono + Inter
- [x] BTC price ticker strip (top bar, always visible)
- [x] FX rate bar (below ticker, shows USD/KRW, USD/JPY, GBP/USD, USD/SEK)
- [x] Main watchlist table: rank, company, price (USD), 24h%, BTC held, BTC/share (sats), mNAV(EV), risk
- [x] Mobile: responsive table with hidden columns on small screens
- [x] mNAV color-coded badge (green/yellow/red)
- [x] Risk badge (LOW/MOD/HIGH/CRIT/NONE)
- [x] Row expand: shows disclosure feed + debt breakdown
- [x] Disclosure section: TDnet / LSE / MFN latest filings
- [x] Auto-refresh every 60 seconds
- [x] Loading skeleton states
- [x] Last updated timestamp

## UX Improvements (Round 2)
- [x] TDnet disclosure titles: translate Japanese → English via LLM on server
- [x] Disclosure UI: simplify to title + direct link only (remove source badge, PDF separate)
- [x] BTC price strip: rename "Upbit KRW" → "BTC-KRW", show kimchi premium inline next to it
- [x] Hide mNAV/Coverage formula text behind a collapsible toggle

## UX Improvements (Round 3)
- [x] Kimchi premium badge: make smaller/subtler in BTC strip

## UX Improvements (Round 4)
- [x] Inline tooltips: mNAV column header, BTC Coverage detail stat, Net Debt label — show formula on hover
- [x] Remove FormulaToggle block (replaced by inline tooltips)

## UX Improvements (Round 5)
- [x] Kimchi premium: replace +0.23% text with 🥬 emoji (tooltip shows the % on hover)
- [x] Inline InfoTip tooltips on mNAV column header and BTC Coverage detail stat
- [x] Remove FormulaToggle block (replaced by inline tooltips)

## UX Improvements (Round 6)
- [x] Kimchi premium: show % number visibly next to 🥬 emoji (small font, colored)

## UX Improvements (Round 7)
- [x] BTC supply share: show (btcHeld / 21M × 100, 2dp) as small text next to BTC Held in table row
- [x] BTC supply share: also show in expanded detail panel

## UX Improvements (Round 8)
- [x] Remove 🥬 kimchi from BTC strip; add kimchi premium as small text in FX bar

## UX Improvements (Round 9)
- [x] Exchange Disclosures: company tabs (All / Strategy / Metaplanet / SWC / H100)
- [x] Exchange Disclosures: collapsible section (collapsed by default)- [x] Exchange Disclosures: clean per-company layout -- exchange badge + date + title link only

## Data Fixes (Round 1)
- [x] Strategy MSTR: pull live btcHeld from strategy.com API (762,099 confirmed LIVE)

## Exchange Disclosures (Round 2)
- [x] SEC EDGAR: fetch latest 8-K/SC 13G filings for Strategy (MSTR, CIK 0001050446)
- [x] SEC EDGAR: fetch latest 8-K filings for Nakamoto Inc. (NAKA)
- [x] Add MSTR and NAKA tabs to DisclosureFeed company filter (tabs are auto-generated from disclosure data)

## UX Improvements (Round 10)
- [x] Sort by: remove Price, add BTC/Share (sats per share)

## Bug Fixes (Round 1)
- [x] H100 MFN disclosures: fix broken/null URL so items are clickable
