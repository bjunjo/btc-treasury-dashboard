import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, TrendingDown, TrendingUp, AlertTriangle, Info, ChevronDown, ChevronUp, Bitcoin } from "lucide-react";
import type { CompanyData, Disclosure, TreasuryData } from "../../../server/treasury";

// ── InfoTip ───────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Risk Badge ────────────────────────────────────────────────────────────────

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

// ── mNAV Badge ────────────────────────────────────────────────────────────────

function MNavBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground font-mono text-sm">—</span>;
  const cls = value < 1.5
    ? "text-risk-low"
    : value < 3
    ? "text-risk-mod"
    : "text-risk-crit";
  return <span className={`font-mono text-sm tabular-nums font-semibold ${cls}`}>{value.toFixed(2)}x</span>;
}

// ── FX Rate Bar ───────────────────────────────────────────────────────────────

function FxBar({ fx }: { fx: TreasuryData["fx"] }) {
  const items = [
    fmtFx("USD/KRW", fx.usdKrw, "₩", 0),
    fmtFx("USD/JPY", fx.usdJpy, "¥", 2),
    fmtFx("GBP/USD", fx.gbpUsd, "$", 4),
    fmtFx("USD/SEK", fx.usdSek, "kr", 2),
  ];

  return (
    <div className="border-b border-border bg-card/50">
      <div className="container py-1.5">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {items.map((item, i) => (
            <span key={i} className="font-mono text-xs text-muted-foreground tabular-nums">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BTC Ticker Strip ──────────────────────────────────────────────────────────

function BtcStrip({ btc }: { btc: TreasuryData["btc"] }) {
  const { text, up } = fmtPct(btc.change24h);
  return (
    <div className="border-b border-border bg-card">
      <div className="container py-2.5 flex items-center justify-between gap-4">
        {/* Left: BTC USD price */}
        <div className="flex items-center gap-3">
          <Bitcoin className="w-5 h-5 text-btc flex-shrink-0" />
          <div>
            <span className="font-mono text-xl font-bold text-foreground tabular-nums">
              {fmtUsd(btc.usd)}
            </span>
            <span className={`ml-2 font-mono text-sm tabular-nums ${up ? "text-up" : "text-down"}`}>
              {up
                ? <TrendingUp className="inline w-3.5 h-3.5 mr-0.5" />
                : <TrendingDown className="inline w-3.5 h-3.5 mr-0.5" />
              }
              {text}
            </span>
          </div>
        </div>

        {/* Right: BTC-KRW + kimchi emoji */}
        {btc.krwUpbit && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">BTC-KRW</span>
              {btc.kimchiPremium !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 cursor-help">
                      <span className="text-base leading-none select-none">🥬</span>
                      <span
                        className={`font-mono tabular-nums leading-none ${
                          btc.kimchiPremium >= 0 ? "text-up" : "text-down"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {btc.kimchiPremium >= 0 ? "+" : ""}{btc.kimchiPremium.toFixed(2)}%
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-mono text-xs font-semibold">Kimchi Premium</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upbit KRW price vs USD price × FX rate
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="font-mono text-sm text-foreground tabular-nums">
              ₩{btc.krwUpbit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Company Row ───────────────────────────────────────────────────────────────

function CompanyRow({
  company,
  rank,
  disclosures,
}: {
  company: CompanyData;
  rank: number;
  disclosures: Disclosure[];
}) {
  const [expanded, setExpanded] = useState(false);
  const chg = fmtPct(company.change24h);
  const companyDisclosures = disclosures.filter(d => d.company === company.name);

  return (
    <>
      <tr
        className="company-row border-b border-border cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank */}
        <td className="py-3 pl-4 pr-2 w-10">
          <span className="font-mono text-2xl font-bold text-muted-foreground/40 tabular-nums leading-none">
            {rank}
          </span>
        </td>

        {/* Company */}
        <td className="py-3 pr-4 min-w-[140px]">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{company.flag}</span>
            <div>
              <div className="font-semibold text-foreground text-sm leading-tight">{company.name}</div>
              <div className="font-mono text-xs text-muted-foreground mt-0.5">{company.ticker}</div>
            </div>
          </div>
        </td>

        {/* Price (USD) */}
        <td className="py-3 pr-4 text-right hidden sm:table-cell">
          <div className="font-mono text-sm text-foreground tabular-nums">
            {company.priceUsd !== null ? fmtUsd(company.priceUsd) : "—"}
          </div>
          <div className={`font-mono text-xs tabular-nums mt-0.5 ${chg.up ? "text-up" : "text-down"}`}>
            {chg.text}
          </div>
        </td>

        {/* BTC Held */}
        <td className="py-3 pr-4 text-right">
          <span className="font-mono text-sm font-semibold text-btc tabular-nums">
            {fmtBtc(company.btcHeld)}
          </span>
          <span className="font-mono text-muted-foreground/60 tabular-nums ml-1" style={{ fontSize: "10px" }}>
            {((company.btcHeld / 21_000_000) * 100).toFixed(2)}%
          </span>
        </td>

        {/* BTC/Share */}
        <td className="py-3 pr-4 text-right hidden md:table-cell">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {fmtSats(company.btcPerShareSats)}
          </span>
        </td>

        {/* mNAV */}
        <td className="py-3 pr-4 text-right hidden sm:table-cell">
          <MNavBadge value={company.mNavEv} />
        </td>

        {/* Risk */}
        <td className="py-3 pr-4 text-right hidden sm:table-cell">
          <RiskBadge label={company.riskLabel} />
        </td>

        {/* Expand */}
        <td className="py-3 pr-3 text-right w-8">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
          }
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-card/30">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <DetailStat label="Market Cap (FD)" value={fmtUsd(company.fdMarketCapUsd, true)} />
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-border py-4 px-4 flex items-center gap-4">
          <div className="skeleton w-6 h-7 rounded" />
          <div className="flex items-center gap-2 flex-1">
            <div className="skeleton w-7 h-7 rounded-full" />
            <div className="space-y-1.5">
              <div className="skeleton w-24 h-4 rounded" />
              <div className="skeleton w-14 h-3 rounded" />
            </div>
          </div>
          <div className="skeleton w-20 h-5 rounded ml-auto" />
          <div className="skeleton w-24 h-5 rounded hidden sm:block" />
          <div className="skeleton w-14 h-5 rounded hidden sm:block" />
          <div className="skeleton w-14 h-5 rounded hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

// ── Disclosure Feed ────────────────────────────────────────────────────────────

function DisclosureFeed({ disclosures }: { disclosures: Disclosure[] }) {
  if (disclosures.length === 0) return null;
  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      <div className="bg-card px-4 py-3 border-b border-border flex items-center gap-2">
        <Info className="w-4 h-4 text-btc" />
        <span className="text-sm font-semibold text-foreground">Exchange Disclosures</span>
        <span className="text-xs text-muted-foreground ml-1">— legally authoritative filings</span>
      </div>
      <div className="divide-y divide-border">
        {disclosures.slice(0, 8).map((d, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-card/50 transition-colors">
            <span className={`flex-shrink-0 font-bold text-sm w-4 text-center ${d.isBtc ? "text-btc" : "text-transparent"}`}>₿</span>
            <span className="flex-shrink-0 text-xs font-mono text-btc w-24 truncate">{d.company}</span>
            <span className="flex-shrink-0 font-mono text-xs text-muted-foreground hidden sm:block w-32">{d.date.slice(0, 16)}</span>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {d.isInsideInfo && <AlertTriangle className="w-3 h-3 text-risk-high flex-shrink-0" />}
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:text-btc transition-colors truncate"
                  title={d.title}
                >
                  {d.title}
                </a>
              ) : (
                <span className="text-sm text-foreground truncate" title={d.title}>{d.title}</span>
              )}
              {d.pdfUrl && (
                <a
                  href={d.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs text-btc hover:underline font-mono"
                  onClick={e => e.stopPropagation()}
                >
                  PDF↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { data, isLoading, error, refetch, isFetching } = trpc.treasury.getData.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  const [sortBy, setSortBy] = useState<"btc" | "mnav" | "price">("btc");
  const lastUpdatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (data?.lastUpdated) lastUpdatedRef.current = data.lastUpdated;
  }, [data?.lastUpdated]);

  const sortedCompanies = data?.companies
    ? [...data.companies].sort((a, b) => {
        if (sortBy === "btc")   return b.btcHeld - a.btcHeld;
        if (sortBy === "mnav")  return (a.mNavEv ?? 999) - (b.mNavEv ?? 999);
        if (sortBy === "price") return (b.priceUsd ?? 0) - (a.priceUsd ?? 0);
        return 0;
      })
    : [];

  const totalBtc = data?.companies.reduce((s, c) => s + c.btcHeld, 0) ?? 0;
  const totalTreasuryUsd = data?.companies.reduce((s, c) => s + (c.btcTreasuryUsd ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bitcoin className="w-5 h-5 text-btc" />
            <span className="font-bold text-foreground tracking-tight">BTC Treasury</span>
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5">
              Intelligence
            </span>
          </div>
          <div className="flex items-center gap-3">
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
      {data && <FxBar fx={data.fx} />}

      {/* Main content */}
      <main className="container py-6">
        {/* Summary stats */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SummaryStat label="Companies Tracked" value={`${data.companies.length}`} />
            <SummaryStat label="Total BTC Held" value={fmtBtc(totalBtc)} accent />
            <SummaryStat label="Total Treasury Value" value={fmtUsd(totalTreasuryUsd, true)} />
            <SummaryStat label="BTC Price" value={fmtUsd(data.btc.usd)} />
          </div>
        )}

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {(["btc", "mnav", "price"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors font-mono ${
                sortBy === s
                  ? "border-btc/50 text-btc bg-btc-dim"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {s === "btc" ? "BTC Held" : s === "mnav" ? "mNAV" : "Price"}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="bg-card border-b border-border">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground font-medium">
                  <th className="py-2.5 pl-4 pr-2 text-left w-10">#</th>
                  <th className="py-2.5 pr-4 text-left">Company</th>
                  <th className="py-2.5 pr-4 text-right hidden sm:table-cell">Price (USD)</th>
                  <th className="py-2.5 pr-4 text-right">BTC Held</th>
                  <th className="py-2.5 pr-4 text-right hidden md:table-cell">BTC/Share</th>
                  <th className="py-2.5 pr-4 text-right hidden sm:table-cell">
                    <span className="inline-flex items-center justify-end">
                      mNAV
                      <InfoTip>
                        <p className="font-mono text-xs font-semibold">mNAV(EV) = (FD Market Cap + Net Debt) ÷ BTC Treasury Value</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enterprise Value premium over BTC NAV. 1.0x = fair value.</p>
                      </InfoTip>
                    </span>
                  </th>
                  <th className="py-2.5 pr-4 text-right hidden sm:table-cell">
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
            </table>
          </div>

          {/* Table body */}
          {isLoading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-risk-high" />
              <p className="text-sm">Failed to load data. Please refresh.</p>
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {sortedCompanies.map((company, i) => (
                  <CompanyRow
                    key={company.ticker}
                    company={company}
                    rank={i + 1}
                    disclosures={data?.disclosures ?? []}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Disclosure feed */}
        {data && <DisclosureFeed disclosures={data.disclosures} />}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Data: CoinGecko · Upbit · Yahoo Finance · TDnet (TSE) · LSE alldata · MFN (Nasdaq First North) · strategy.com
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Auto-refreshes every 60s
          </div>
        </div>
      </main>
    </div>
  );
}

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
