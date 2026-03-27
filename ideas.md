# BTC Treasury Intelligence Dashboard — Design Ideas

## Context
- Reference: companiesmarketcap.com (clean data table, rank numbers, minimal chrome)
- Philosophy: Toss/Linear — one core action per screen, no clutter
- User: Billy, power user who reads financial data fast on mobile
- Core action: Instantly see which BTC treasury company is the best value right now

---

<response>
<probability>0.07</probability>
<text>

## Idea A: "Terminal Noir" — Dark Data Terminal

**Design Movement:** Bloomberg Terminal meets Linear.app dark mode

**Core Principles:**
1. Data density without noise — every pixel earns its place
2. Monospace numbers, proportional labels — clear visual hierarchy between data and metadata
3. Horizontal scroll on mobile for table columns, sticky rank + name columns
4. Accent color = Bitcoin orange (#F7931A) on pure dark background

**Color Philosophy:**
- Background: `#0D0D0D` (near-black, not pure black — reduces eye strain)
- Surface: `#141414` cards
- Border: `#1F1F1F` hairlines
- Text primary: `#F0F0F0`
- Text muted: `#666666`
- BTC Orange: `#F7931A` — used only for BTC amounts, key metrics
- Green: `#22C55E` for positive change
- Red: `#EF4444` for negative change

**Layout Paradigm:**
- Full-width table, no sidebar
- Sticky header with BTC price ticker strip (like a Bloomberg strip)
- Rank number in large muted type, company name bold, all metrics right-aligned
- FX rate bar pinned below the BTC ticker strip

**Signature Elements:**
1. Rank number in huge `tabular-nums` monospace, muted — creates visual rhythm
2. BTC amount column highlighted with orange tint background
3. mNAV badge: color-coded pill (green < 1.5x, yellow < 3x, red ≥ 3x)

**Interaction Philosophy:**
- Tap row to expand: shows disclosure feed, debt breakdown, BTC/share
- Sort by column tap
- Pull-to-refresh on mobile

**Animation:**
- Number counters animate on load (count up from 0)
- Row hover: subtle left border highlight in orange
- Disclosure expand: smooth height transition

**Typography System:**
- Display numbers: `JetBrains Mono` (tabular, monospace)
- Labels/names: `Inter` 500 weight
- Headlines: `Inter` 700

</text>
</response>

<response>
<probability>0.08</probability>
<text>

## Idea B: "Clean Sheet" — Minimal White Financial

**Design Movement:** Robinhood + companiesmarketcap.com exact clone spirit

**Core Principles:**
1. White background, maximum readability — like a financial newspaper
2. Rank numbers as the dominant visual element (large, gray)
3. Company logos as the only visual decoration
4. Thin hairline separators, no card boxes

**Color Philosophy:**
- Background: `#FFFFFF`
- Text: `#111827` (near-black)
- Muted: `#6B7280`
- Border: `#F3F4F6` (very light)
- BTC Orange: `#F7931A`
- Green: `#16A34A`, Red: `#DC2626`
- Accent blue for links: `#2563EB`

**Layout Paradigm:**
- companiesmarketcap.com exact layout: rank | logo | name | market cap | BTC | mNAV | change
- Mobile: collapse to rank | name | BTC | change (hide less critical columns)
- FX strip at top, always visible

**Signature Elements:**
1. Large gray rank numbers (like companiesmarketcap)
2. Sparkline mini-chart in each row (30-day price)
3. Country flag emoji next to company name

**Typography System:**
- Body: `DM Sans` — clean, modern, slightly different from Inter
- Numbers: `DM Mono` for all financial figures

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Idea C: "Sats Standard" — Bold Orange Accent Dark

**Design Movement:** Bitcoin Magazine aesthetic + Vercel dark dashboard

**Core Principles:**
1. Dark navy background (not pure black) — premium feel
2. Bitcoin orange as the primary brand color
3. Large hero BTC price at top — the anchor of everything
4. Table rows as cards on mobile (card-per-company view)

**Color Philosophy:**
- Background: `#0A0F1E` (dark navy)
- Surface: `#111827`
- Border: `#1E2A3A`
- Text: `#E2E8F0`
- BTC Orange: `#F7931A`
- Accent: `#3B82F6` (blue for links/interactive)
- Green: `#10B981`, Red: `#F43F5E`

**Layout Paradigm:**
- Hero section: BTC price large + 24h change + total treasury BTC across all companies
- Below: sortable table with sticky columns
- Mobile: card view (one card per company, swipeable)

**Signature Elements:**
1. Total BTC held by all watchlist companies shown as a hero stat
2. "₿ per share" shown in sats (not BTC) for small values
3. Disclosure feed as a sidebar on desktop, bottom sheet on mobile

**Typography System:**
- Headlines: `Space Grotesk` — geometric, Bitcoin-adjacent
- Numbers: `Space Mono` — monospace, technical
- Body: `Space Grotesk` 400

</text>
</response>

---

## Selected Design: **Idea A — Terminal Noir**

Rationale: Billy reads financial data like a trader. Dark terminal aesthetic reduces eye strain during long sessions. Bitcoin orange on dark background is the most visually distinctive and on-brand. The monospace number rendering makes scanning rows fast. companiesmarketcap.com is already "clean white" — this differentiates while keeping the same data density.
