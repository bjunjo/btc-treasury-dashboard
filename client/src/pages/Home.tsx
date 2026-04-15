import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, TrendingDown, TrendingUp, AlertTriangle, Info, ChevronDown, ChevronUp, Bitcoin, ShieldAlert } from "lucide-react";
import type { CompanyData, Disclosure, TreasuryData } from "../../../server/treasury";

// -

// ── Legal Disclaimer Modal ────────────────────────────────────────────────────

const DISCLAIMER_KEY = "btc_treasury_disclaimer_v1";

function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <h2 className="font-mono text-sm font-bold text-foreground">Legal Disclaimer</h2>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>
            <span className="text-foreground font-semibold">For personal informational use only.</span>{" "}
            This dashboard is a private research tool and does not constitute financial advice, investment advice, trading advice, or any other form of advice.
          </p>
          <p>
            Nothing on this site should be construed as a recommendation to buy, sell, or hold any security, cryptocurrency, or other financial instrument. All data is sourced from third-party APIs and public filings and may be delayed, inaccurate, or incomplete.
          </p>
          <p>
            <span className="text-foreground font-semibold">No warranty is given</span> as to the accuracy, completeness, or timeliness of the information displayed. The creator of this tool accepts no liability whatsoever for any loss or damage arising from reliance on this data.
          </p>
          <p>
            By continuing, you confirm that you are accessing this tool for personal research purposes only and that you will not rely on it for any financial or investment decisions.
          </p>
        </div>
        <button
          onClick={onAccept}
          className="mt-5 w-full py-2.5 rounded-lg bg-btc text-black font-mono text-xs font-bold hover:bg-btc/90 transition-colors"
        >
          I understand — Continue to Dashboard
        </button>
      </div>
    </div>
  );
}

// -

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-help ml-1 align-middle text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
            <text x="6" y="9.2" textAnchor="middle" fontSize="7.5" fill="currentColor" fontFamily="monospace" fontWeight="bold">i</text>
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] text-left leading-relaxed space-y-1">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

// -

function fmtUsd(n: number | null, compact = false): string {
  if (n === null || n === undefined) return "—";
  if (compact) {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Market cap always in Billions with 2 decimal places (e.g. $45.94B, $0.21B)
function fmtMktCap(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `$${(n / 1e9).toFixed(2)}B`;
}

function fmtBtc(n: number): string {
  return `₿${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtSats(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `${Math.round(n).toLocaleString("en-US")} sat`;
  return `${n.toFixed(0)} sat`;
}

function fmtPct(n: number | null): { text: string; up: boolean } {
  if (n === null) return { text: "—", up: true };
  return { text: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, up: n >= 0 };
}

function fmtFx(label: string, value: number, prefix: string, decimals = 2): string {
  return `${label}: ${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// -

function RiskBadge({ label }: { label: CompanyData["riskLabel"] }) {
  const styles: Record<string, string> = {
    LOW:  "text-risk-low border border-green-800/40 bg-green-900/20",
    MOD:  "text-risk-mod border border-yellow-700/40 bg-yellow-900/20",
    HIGH: "text-risk-high border border-orange-700/40 bg-orange-900/20",
    CRIT: "text-risk-crit border border-red-700/40 bg-red-900/20",
    NONE: "text-muted-foreground border border-border bg-transparent",
  };
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded tabular-nums ${styles[label] ?? styles.NONE}`}>
      {label}
    </span>
  );
}

// -

function DataStatusPill({ status }: { status: NonNullable<TreasuryData["status"]> }) {
  const degraded = status.anyFallback;
  const label = !degraded ? "LIVE"
    : status.btc === "FALLBACK" ? "BTC FALLBACK"
    : status.stocks === "FALLBACK" ? "STOCKS FALLBACK"
    : "DEGRADED";
  const cls = !degraded
    ? "border-green-500/50 text-green-500 bg-green-500/10"
    : "border-yellow-500/60 text-yellow-600 bg-yellow-500/10";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border cursor-help ${cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${degraded ? "bg-yellow-500" : "bg-green-500"}`} />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px] text-left leading-relaxed font-mono text-xs space-y-0.5">
        <div>BTC: <span className={status.btc === "LIVE" ? "text-green-500" : "text-yellow-500"}>{status.btc}</span> <span className="text-muted-foreground">({status.btcSource})</span></div>
        <div>Stocks: <span className={status.stocks === "LIVE" ? "text-green-500" : "text-yellow-500"}>{status.stocks}</span> <span className="text-muted-foreground">({status.stockCoverage.live}/{status.stockCoverage.total} live)</span></div>
        {status.stockCoverage.missing.length > 0 && (
          <div className="text-muted-foreground">Missing: {status.stockCoverage.missing.join(", ")}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function HardcodedWarn() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center ml-1 align-middle text-yellow-500/80 hover:text-yellow-500 cursor-help"
          onClick={e => e.stopPropagation()}
        >
          <AlertTriangle className="w-3 h-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-left leading-relaxed">
        Using last known value — live data unavailable.
      </TooltipContent>
    </Tooltip>
  );
}

// -

function MNavBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground font-mono text-sm">—</span>;
  const cls = value < 1.0
    ? "text-muted-foreground"
    : value < 1.5
    ? "text-risk-low"
    : value <= 3
    ? "text-risk-mod"
    : "text-risk-crit";
  return <span className={`font-mono text-sm tabular-nums font-semibold ${cls}`}>{value.toFixed(2)}x</span>;
}

// -

function FxBar({ fx, kimchiPremium }: { fx: TreasuryData["fx"]; kimchiPremium: number | null }) {
  const items = [
    fmtFx("USD/KRW", fx.usdKrw, "₩", 0),
    fmtFx("USD/JPY", fx.usdJpy, "¥", 2),
    fmtFx("GBP/USD", fx.gbpUsd, "$", 4),
    fmtFx("USD/SEK", fx.usdSek, "kr", 2),
  ];

  return (
    <div className="border-b border-border bg-card/50">
      <div className="container py-1.5">
        <div className="flex flex-wrap gap-x-5 gap-y-1 items-center">
          {items.map((item, i) => (
            <span key={i} className="font-mono text-xs text-muted-foreground tabular-nums">
              {item}
            </span>
          ))}
          {kimchiPremium !== null && (
            <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
              Kimchi{" "}
              <span className={kimchiPremium >= 0 ? "text-up" : "text-down"}>
                {kimchiPremium >= 0 ? "+" : ""}{kimchiPremium.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// -

function BtcStrip({ btc }: { btc: TreasuryData["btc"] }) {
  const isFallback = btc.confidence === "FALLBACK";
  const { text, up } = fmtPct(isFallback ? null : btc.change24h);
  return (
    <div className={`border-b border-border ${isFallback ? "bg-yellow-500/10" : "bg-card"}`}>
      <div className="container py-2.5 flex items-center justify-between gap-4">
        {/* Left: BTC USD price */}
        <div className="flex items-center gap-3">
          <Bitcoin className="w-5 h-5 text-btc flex-shrink-0" />
          <div>
            <span className={`font-mono text-xl font-bold tabular-nums ${isFallback ? "text-muted-foreground line-through decoration-yellow-500/60" : "text-foreground"}`}>
              {fmtUsd(btc.usd)}
            </span>
            {isFallback ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-yellow-500/60 text-yellow-600 bg-yellow-500/10 cursor-help">
                    <AlertTriangle className="w-3 h-3" />
                    Fallback
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-left leading-relaxed">
                  Live BTC price sources (CoinGecko, Binance, Coinbase) all failed.
                  Displayed value is a last-known placeholder and 24h change is suppressed —
                  treasury value, mNAV and kimchi premium are unreliable until live data returns.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className={`ml-2 font-mono text-sm tabular-nums ${up ? "text-up" : "text-down"}`}>
                {up
                  ? <TrendingUp className="inline w-3.5 h-3.5 mr-0.5" />
                  : <TrendingDown className="inline w-3.5 h-3.5 mr-0.5" />
                }
                {text}
              </span>
            )}
          </div>
        </div>

        {/* Right: BTC-KRW price */}
        {btc.krwUpbit && (
          <div className="text-right">
            <div className="font-mono text-xs text-muted-foreground">BTC-KRW</div>
            <div className="font-mono text-sm text-foreground tabular-nums">
              ₩{btc.krwUpbit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -

// Column visibility: which columns show at which breakpoint
// mobile (default): Rank, Company, BTC Held, Expand
// sm (640px+):       + Price, Mkt Cap, mNAV, Risk
// md (768px+):       + BTC/Share

function CompanyRow({
  company,
  rank,
  disclosures,
  sortBy,
}: {
  company: CompanyData;
  rank: number;
  disclosures: Disclosure[];
  sortBy: SortKey;
}) {
  const [expanded, setExpanded] = useState(false);
  const chg = fmtPct(company.change24h);
  const companyDisclosures = disclosures.filter(d => d.company === company.name);

  return (
    <>
      <tr
        className="company-row border-b border-border cursor-pointer hover:bg-card/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank */}
        <td className="py-3 pl-4 pr-2 w-10 align-middle">
          <span className="font-mono text-2xl font-bold text-muted-foreground/40 tabular-nums leading-none">
            {rank}
          </span>
        </td>

        {/* Company */}
        <td className="py-3 pr-3 align-middle" style={{ minWidth: "130px" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{company.flag}</span>
            <div>
              <div className="font-semibold text-foreground text-sm leading-tight">{company.name}</div>
              <div className="font-mono text-xs text-muted-foreground mt-0.5">{company.ticker}</div>
            </div>
          </div>
        </td>

        {/* Price (USD) — hidden on mobile */}
        <td className="py-3 pr-3 text-right align-middle hidden sm:table-cell">
          <div className="font-mono text-sm text-foreground tabular-nums inline-flex items-center justify-end">
            {company.priceUsd !== null ? fmtUsd(company.priceUsd) : "—"}
            {company.priceConfidence === "HARDCODED" && <HardcodedWarn />}
          </div>
          <div className={`font-mono text-xs tabular-nums mt-0.5 ${chg.up ? "text-up" : "text-down"}`}>
            {chg.text}
          </div>
        </td>

        {/* Mkt Cap (FD) — hidden on mobile, shown when sorted */}
        <td className={`py-3 pr-3 text-right align-middle ${sortBy === "mktCap" ? "table-cell text-btc" : "hidden sm:table-cell"}`}>
          <span className="font-mono text-sm tabular-nums font-semibold">
            {fmtMktCap(company.fdMarketCapUsd)}
          </span>
          <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">FD</div>
        </td>

        {/* BTC Held */}
        <td className={`py-3 pr-3 text-right align-middle ${sortBy === "btc" ? "text-btc" : ""}`}>
          <span className="font-mono text-sm font-semibold text-btc tabular-nums">
            {fmtBtc(company.btcHeld)}
          </span>
          {company.btcConfidence === "HARDCODED" && <HardcodedWarn />}
          <span className="font-mono text-muted-foreground/60 tabular-nums ml-1" style={{ fontSize: "10px" }}>
            {((company.btcHeld / 21_000_000) * 100).toFixed(2)}%
          </span>
        </td>

        {/* BTC/Share — hidden on mobile/sm, shown when sorted */}
        <td className={`py-3 pr-3 text-right align-middle ${sortBy === "btcPerShare" ? "table-cell text-btc" : "hidden md:table-cell"}`}>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {fmtSats(company.btcPerShareSats)}
          </span>
        </td>

        {/* mNAV — hidden on mobile, shown when sorted */}
        <td className={`py-3 pr-3 text-right align-middle ${sortBy === "mnav" ? "table-cell" : "hidden sm:table-cell"}`}>
          <MNavBadge value={company.mNavEv} />
        </td>

        {/* Risk — hidden on mobile */}
        <td className="py-3 pr-3 text-right align-middle hidden sm:table-cell">
          <RiskBadge label={company.riskLabel} />
        </td>

        {/* Expand chevron */}
        <td className="py-3 pr-3 text-right align-middle w-8">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
          }
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-card/30">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <DetailStat label="Market Cap (FD)" value={fmtMktCap(company.fdMarketCapUsd)} />
              <DetailStat
                label="BTC Treasury"
                value={fmtUsd(company.btcTreasuryUsd, true)}
                tip={
                  <>
                    <p className="font-mono text-xs font-semibold">
                      {fmtBtc(company.btcHeld)} · {((company.btcHeld / 21_000_000) * 100).toFixed(2)}% of total supply
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Based on 21,000,000 BTC max supply
                    </p>
                  </>
                }
              />
              <DetailStat
                label="Total Debt"
                value={fmtUsd(company.debtUsd, true)}
                tip={
                  <>
                    <p className="font-mono text-xs font-semibold">Net Debt = Total Debt − Cash</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      EV (Enterprise Value) reflects the true cost of acquiring the company including its debt load.
                    </p>
                  </>
                }
              />
              <DetailStat
                label="BTC Coverage"
                value={
                  company.btcCoverage !== null && company.debtUsd > 0
                    ? `${company.btcCoverage.toFixed(2)}x`
                    : company.debtUsd === 0 ? "No debt" : "—"
                }
                tip={
                  <>
                    <p className="font-mono text-xs font-semibold">BTC Coverage = BTC Treasury Value ÷ Total Debt</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      How many times the BTC treasury covers total debt. Higher = safer.
                    </p>
                  </>
                }
              />
              <DetailStat label="Exchange" value={company.exchange} />
              <DetailStat label="BTC/Share" value={fmtSats(company.btcPerShareSats)} />
              <DetailStat
                label="mNAV (EV)"
                value={company.mNavEv !== null ? `${company.mNavEv.toFixed(3)}x` : "—"}
                tip={
                  <>
                    <p className="font-mono text-xs font-semibold">mNAV(EV) = (FD Market Cap + Net Debt) ÷ BTC Treasury Value</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enterprise Value-based premium over BTC NAV. 1.0x = fair value. &gt;1x = premium to BTC.
                    </p>
                  </>
                }
              />
              <DetailStat label="Price (local)" value={
                company.priceLocal !== null
                  ? `${company.localCurrency === "GBp" ? "p" : company.localCurrency === "JPY" ? "¥" : company.localCurrency === "SEK" ? "kr" : "$"}${company.priceLocal.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"
              } />
            </div>

            {/* Mobile-only fields */}
            <div className="sm:hidden grid grid-cols-2 gap-3 mb-4">
              <DetailStat label="Price (USD)" value={company.priceUsd !== null ? fmtUsd(company.priceUsd) : "—"} />
              <DetailStat label="Mkt Cap (FD)" value={fmtMktCap(company.fdMarketCapUsd)} />
              <DetailStat label="24h Change" value={chg.text} valueClass={chg.up ? "text-up" : "text-down"} />
              <DetailStat label="mNAV (EV)" value={company.mNavEv !== null ? `${company.mNavEv.toFixed(2)}x` : "—"} />
            </div>

            {/* Disclosures */}
            {companyDisclosures.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Latest Disclosures
                </div>
                <div className="space-y-1.5">
                  {companyDisclosures.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {d.isBtc && <span className="text-btc flex-shrink-0 mt-0.5">₿</span>}
                      {d.isInsideInfo && <AlertTriangle className="w-3 h-3 text-risk-high flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground">{d.date.slice(0, 16)} · </span>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-btc transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {d.title}
                          </a>
                        ) : (
                          <span className="text-foreground">{d.title}</span>
                        )}
                        {d.pdfUrl && (
                          <a
                            href={d.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-btc hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            PDF
                          </a>
                        )}
                      </div>
                      <span className="text-muted-foreground/60 flex-shrink-0 hidden sm:block">{d.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DetailStat({
  label,
  value,
  valueClass = "",
  tip,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tip?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5 flex items-center">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      <div className={`font-mono text-sm font-medium tabular-nums ${valueClass || "text-foreground"}`}>{value}</div>
    </div>
  );
}

// -

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="py-4 pl-4 pr-2 w-10"><div className="skeleton w-6 h-7 rounded" /></td>
          <td className="py-4 pr-3" style={{ minWidth: "130px" }}>
            <div className="flex items-center gap-2">
              <div className="skeleton w-7 h-7 rounded-full" />
              <div className="space-y-1.5">
                <div className="skeleton w-24 h-4 rounded" />
                <div className="skeleton w-14 h-3 rounded" />
              </div>
            </div>
          </td>
          <td className="py-4 pr-3 hidden sm:table-cell"><div className="skeleton w-20 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3 hidden sm:table-cell"><div className="skeleton w-16 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3"><div className="skeleton w-24 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3 hidden md:table-cell"><div className="skeleton w-16 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3 hidden sm:table-cell"><div className="skeleton w-14 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3 hidden sm:table-cell"><div className="skeleton w-14 h-5 rounded ml-auto" /></td>
          <td className="py-4 pr-3 w-8" />
        </tr>
      ))}
    </tbody>
  );
}

// -

// Exchange badge colours
const EXCHANGE_STYLE: Record<string, string> = {
  TDnet:  "bg-red-900/30 text-red-400 border-red-800/40",
  "LSE/RNS": "bg-blue-900/30 text-blue-400 border-blue-800/40",
  MFN:    "bg-purple-900/30 text-purple-400 border-purple-800/40",
  SEC:    "bg-green-900/30 text-green-400 border-green-800/40",
};

function ExchangeBadge({ source }: { source: string }) {
  const cls = EXCHANGE_STYLE[source] ?? "bg-card text-muted-foreground border-border";
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${cls}`}>
      {source}
    </span>
  );
}

function DisclosureFeed({ disclosures, companies }: { disclosures: Disclosure[]; companies: CompanyData[] }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [btcOnly, setBtcOnly] = useState(false);

  if (disclosures.length === 0) return null;

  // Build tab list from companies that have disclosures
  const tabs = ["All", ...companies
    .filter(c => disclosures.some(d => d.company === c.name))
    .map(c => c.name)
  ];

  let filtered = activeTab === "All"
    ? disclosures
    : disclosures.filter(d => d.company === activeTab);
  if (btcOnly) filtered = filtered.filter(d => d.isBtc);

  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <button
        className="w-full bg-card px-4 py-3 border-b border-border flex items-center gap-2 hover:bg-card/80 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Info className="w-4 h-4 text-btc flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground">Exchange Disclosures</span>
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">— legally authoritative filings</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
          {open
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </span>
      </button>

      {open && (
        <>
          {/* Company tabs */}
          <div className="bg-card/50 px-4 pt-3 pb-0 flex gap-1.5 flex-wrap items-center border-b border-border">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-mono px-3 py-1.5 rounded-t border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-btc text-btc bg-btc-dim"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
            <label className="ml-auto mb-1.5 inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={btcOnly}
                onChange={e => setBtcOnly(e.target.checked)}
                className="accent-btc w-3 h-3"
              />
              <span className="text-btc">₿</span>
              BTC-only
            </label>
          </div>

          {/* Disclosure rows */}
          <div className="divide-y divide-border">
            {filtered.slice(0, 10).map((d, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-card/40 transition-colors group">
                {/* BTC indicator */}
                <span className={`flex-shrink-0 font-bold text-sm mt-0.5 ${d.isBtc ? "text-btc" : "text-transparent"}`}>₿</span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <ExchangeBadge source={d.source} />
                    {activeTab === "All" && (
                      <span className="font-mono text-xs text-muted-foreground/70">{d.company}</span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground/60">{d.date.slice(0, 10)}</span>
                    {d.isInsideInfo && (
                      <span className="flex items-center gap-0.5 text-[10px] text-risk-high font-mono">
                        <AlertTriangle className="w-2.5 h-2.5" /> Inside Info
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground hover:text-btc transition-colors leading-snug"
                        title={d.title}
                      >
                        {d.title} <span className="text-muted-foreground/40 text-xs">↗</span>
                      </a>
                    ) : (
                      <span className="text-sm text-foreground leading-snug">{d.title}</span>
                    )}
                    {d.pdfUrl && (
                      <a
                        href={d.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-[10px] text-btc hover:underline font-mono border border-btc/30 rounded px-1 py-0.5"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// -

type SortKey = "btc" | "mnav" | "btcPerShare" | "mktCap" | "chg24h";

const SORT_LABELS: Record<SortKey, string> = {
  btc: "BTC Held",
  mnav: "mNAV",
  btcPerShare: "BTC/Share",
  mktCap: "Mkt Cap",
  chg24h: "24h Chg",
};

export default function Home() {
  const { data, isLoading, error, refetch, isFetching } = trpc.treasury.getData.useQuery(undefined, {
    refetchInterval: 5 * 60_000, // 5 minutes — matches server cache TTL
    staleTime: 55_000,
  });

  // Disclaimer: show modal on first visit, persist acceptance in localStorage
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(() => {
    try { return localStorage.getItem(DISCLAIMER_KEY) === "1"; } catch { return false; }
  });
  const handleAcceptDisclaimer = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, "1"); } catch { /* noop */ }
    setDisclaimerAccepted(true);
  };

  const [sortBy, setSortBy] = useState<SortKey>("btc");
  const lastUpdatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (data?.lastUpdated) lastUpdatedRef.current = data.lastUpdated;
  }, [data?.lastUpdated]);

  const sortedCompanies = data?.companies
    ? [...data.companies].sort((a, b) => {
        if (sortBy === "btc")        return b.btcHeld - a.btcHeld;
        if (sortBy === "mnav")       return (a.mNavEv ?? 999) - (b.mNavEv ?? 999);
        if (sortBy === "btcPerShare") return (b.btcPerShareSats ?? 0) - (a.btcPerShareSats ?? 0);
        if (sortBy === "mktCap")     return (b.fdMarketCapUsd ?? 0) - (a.fdMarketCapUsd ?? 0);
        if (sortBy === "chg24h")     return (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity);
        return 0;
      })
    : [];

  const totalBtc = data?.companies.reduce((s, c) => s + c.btcHeld, 0) ?? 0;
  const totalTreasuryUsd = data?.companies.reduce((s, c) => s + (c.btcTreasuryUsd ?? 0), 0) ?? 0;

  // BTC-weighted average mNAV across companies with a known mNAV
  const avgMNavWeighted = (() => {
    if (!data?.companies) return null;
    let num = 0;
    let den = 0;
    for (const c of data.companies) {
      if (c.mNavEv !== null && c.btcHeld > 0) {
        num += c.mNavEv * c.btcHeld;
        den += c.btcHeld;
      }
    }
    return den > 0 ? num / den : null;
  })();

  return (
    <>
      {!disclaimerAccepted && <DisclaimerModal onAccept={handleAcceptDisclaimer} />}
      <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bitcoin className="w-5 h-5 text-btc" />
            <h1 className="font-bold text-foreground tracking-tight text-base leading-none">BTC Treasury</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5">
              Intelligence
            </span>
          </div>
          <div className="flex items-center gap-3">
            {data?.status && <DataStatusPill status={data.status} />}
            {lastUpdatedRef.current && (
              <span className="hidden sm:block text-xs text-muted-foreground font-mono">
                {new Date(lastUpdatedRef.current).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-2.5 py-1.5 hover:border-btc/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-btc" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* BTC Price Strip */}
      {data && <BtcStrip btc={data.btc} />}

      {/* FX Rate Bar */}
      {data && <FxBar fx={data.fx} kimchiPremium={data.btc.kimchiPremium} />}

      {/* Main content */}
      <main className="container py-6">
        {/* Summary stats */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <SummaryStat label="Companies Tracked" value={`${data.companies.length}`} />
            <SummaryStat label="Total BTC Held" value={fmtBtc(totalBtc)} accent />
            <SummaryStat label="Total Treasury Value" value={fmtUsd(totalTreasuryUsd, true)} />
            <SummaryStat
              label="Avg mNAV (BTC-wt)"
              value={avgMNavWeighted !== null ? `${avgMNavWeighted.toFixed(2)}x` : "—"}
            />
            <SummaryStat label="BTC Price" value={fmtUsd(data.btc.usd)} />
          </div>
        )}

        {/* Watchlist heading */}
        <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-3">Bitcoin Treasury Watchlist</h2>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors font-mono ${
                sortBy === s
                  ? "border-btc/50 text-btc bg-btc-dim"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>

        {/* ── Unified table: thead + tbody in one <table> so columns always align ── */}
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-card border-b border-border text-xs text-muted-foreground font-medium">
                <th className="py-2.5 pl-4 pr-2 text-left w-10">#</th>
                <th className="py-2.5 pr-3 text-left" style={{ minWidth: "130px" }}>Company</th>
                <th className="py-2.5 pr-3 text-right hidden sm:table-cell">Price (USD)</th>
                <th className={`py-2.5 pr-3 text-right ${sortBy === "mktCap" ? "table-cell" : "hidden sm:table-cell"}`}>
                  <span className="inline-flex items-center justify-end">
                    Mkt Cap
                    <InfoTip>
                      <p className="font-mono text-xs font-semibold">Market Cap = Fully Diluted Shares × Price (USD)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Fully diluted includes all shares, options, and convertible instruments.</p>
                    </InfoTip>
                  </span>
                </th>
                <th className="py-2.5 pr-3 text-right">BTC Held</th>
                <th className={`py-2.5 pr-3 text-right ${sortBy === "btcPerShare" ? "table-cell" : "hidden md:table-cell"}`}>BTC/Share</th>
                <th className={`py-2.5 pr-3 text-right ${sortBy === "mnav" ? "table-cell" : "hidden sm:table-cell"}`}>
                  <span className="inline-flex items-center justify-end">
                    mNAV
                    <InfoTip>
                      <p className="font-mono text-xs font-semibold">mNAV(EV) = (FD Market Cap + Net Debt) ÷ BTC Treasury Value</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Enterprise Value premium over BTC NAV. 1.0x = fair value.</p>
                    </InfoTip>
                  </span>
                </th>
                <th className="py-2.5 pr-3 text-right hidden sm:table-cell">
                  <span className="inline-flex items-center justify-end">
                    Risk
                    <InfoTip>
                      <p className="font-mono text-xs font-semibold">BTC Coverage = BTC Treasury ÷ Total Debt</p>
                      <p className="text-xs text-muted-foreground mt-0.5">≥5x LOW · 2–5x MOD · 1–2x HIGH · &lt;1x CRIT · No debt NONE</p>
                    </InfoTip>
                  </span>
                </th>
                <th className="py-2.5 pr-3 w-8" />
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton />
            ) : error ? (
              <tbody>
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-risk-high" />
                    <p className="text-sm">Failed to load data. Please refresh.</p>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {sortedCompanies.map((company, i) => (
                  <CompanyRow
                    key={company.ticker}
                    company={company}
                    rank={i + 1}
                    disclosures={data?.disclosures ?? []}
                    sortBy={sortBy}
                  />
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* On the Radar — companies we're watching but not yet fully tracking */}
        <OnTheRadar />

        {/* Disclosure feed */}
        {data && <DisclosureFeed disclosures={data.disclosures} companies={data.companies} />}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-border space-y-3">
          {/* Disclaimer strip */}
          <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5">
            <ShieldAlert className="w-3.5 h-3.5 text-yellow-500/70 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="text-yellow-500/80 font-semibold">Disclaimer:</span>{" "}
              For personal informational use only. Not financial or investment advice. Data may be delayed or inaccurate.
              The creator accepts no liability for decisions made based on this information.
              Always consult a qualified financial professional before making investment decisions.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Data: CoinGecko · Upbit · Yahoo Finance · TDnet (TSE) · LSE alldata · MFN (Nasdaq First North) · strategy.com · SEC EDGAR
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Auto-refreshes every 5 min
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}

// -

const RADAR: Array<{ name: string; flag: string; ticker: string; btc: number }> = [
  { name: "Capital B",  flag: "🇫🇷", ticker: "ALCPB.PA / CPTLF", btc: 2888 },
  { name: "OranjeBTC", flag: "🇧🇷", ticker: "OBTC3",              btc: 3708 },
];

function OnTheRadar() {
  return (
    <div className="mt-6">
      <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        On the Radar
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RADAR.map(r => (
          <div key={r.ticker} className="bg-card border border-border border-dashed rounded-lg px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg leading-none">{r.flag}</span>
              <div className="font-semibold text-sm text-foreground">{r.name}</div>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Radar</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground mb-1">{r.ticker}</div>
            <div className="font-mono text-sm font-semibold text-btc tabular-nums">
              {fmtBtc(r.btc)} <span className="text-muted-foreground/60 text-xs">approx.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -

function SummaryStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`font-mono text-base font-bold tabular-nums ${accent ? "text-btc" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
