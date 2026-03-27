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
