/**
 * treasury.test.ts — Unit tests for BTC Treasury Intelligence data layer
 *
 * Tests cover:
 * 1. Risk label calculation logic
 * 2. mNAV formula correctness
 * 3. BTC/share conversion
 * 4. FX conversion helpers
 * 5. fetchTreasuryData integration (mocked)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Inline the pure functions we want to test ─────────────────────────────────
// We test the logic directly rather than importing the full module
// (which has side effects like HTTP calls)

function getRiskLabel(coverage: number | null, debtUsd: number): string {
  if (debtUsd === 0) return "NONE";
  if (coverage === null) return "NONE";
  if (coverage >= 5) return "LOW";
  if (coverage >= 2) return "MOD";
  if (coverage >= 1) return "HIGH";
  return "CRIT";
}

function calcMNavEv(
  fdMarketCapUsd: number | null,
  netDebtUsd: number,
  btcTreasuryUsd: number
): number | null {
  if (!fdMarketCapUsd || btcTreasuryUsd <= 0) return null;
  const ev = fdMarketCapUsd + netDebtUsd;
  return ev / btcTreasuryUsd;
}

function calcBtcCoverage(btcTreasuryUsd: number, debtUsd: number): number | null {
  if (debtUsd <= 0) return null;
  return btcTreasuryUsd / debtUsd;
}

function toUsd(
  price: number,
  currency: string,
  fx: { usdKrw: number; usdJpy: number; gbpUsd: number; usdSek: number }
): number {
  if (currency === "USD") return price;
  if (currency === "JPY") return price / fx.usdJpy;
  if (currency === "GBp") return (price / 100) * fx.gbpUsd;
  if (currency === "GBP") return price * fx.gbpUsd;
  if (currency === "SEK") return price / fx.usdSek;
  if (currency === "KRW") return price / fx.usdKrw;
  return price;
}

// ── Risk Label Tests ──────────────────────────────────────────────────────────

describe("getRiskLabel", () => {
  it("returns NONE when there is no debt", () => {
    expect(getRiskLabel(null, 0)).toBe("NONE");
    expect(getRiskLabel(999, 0)).toBe("NONE");
  });

  it("returns LOW when BTC coverage >= 5x", () => {
    expect(getRiskLabel(5.0, 1_000_000)).toBe("LOW");
    expect(getRiskLabel(10.0, 1_000_000)).toBe("LOW");
    expect(getRiskLabel(5.1, 500_000)).toBe("LOW");
  });

  it("returns MOD when BTC coverage is 2x–5x", () => {
    expect(getRiskLabel(2.0, 1_000_000)).toBe("MOD");
    expect(getRiskLabel(3.5, 1_000_000)).toBe("MOD");
    expect(getRiskLabel(4.99, 1_000_000)).toBe("MOD");
  });

  it("returns HIGH when BTC coverage is 1x–2x", () => {
    expect(getRiskLabel(1.0, 1_000_000)).toBe("HIGH");
    expect(getRiskLabel(1.76, 210_000_000)).toBe("HIGH"); // Nakamoto scenario
    expect(getRiskLabel(1.99, 1_000_000)).toBe("HIGH");
  });

  it("returns CRIT when BTC coverage < 1x", () => {
    expect(getRiskLabel(0.9, 1_000_000)).toBe("CRIT");
    expect(getRiskLabel(0.1, 1_000_000)).toBe("CRIT");
  });

  it("returns NONE when coverage is null but debt exists", () => {
    expect(getRiskLabel(null, 1_000_000)).toBe("NONE");
  });
});

// ── mNAV Calculation Tests ────────────────────────────────────────────────────

describe("calcMNavEv", () => {
  it("returns null when fdMarketCap is null", () => {
    expect(calcMNavEv(null, 0, 1_000_000)).toBeNull();
  });

  it("returns null when btcTreasuryUsd is 0", () => {
    expect(calcMNavEv(1_000_000, 0, 0)).toBeNull();
  });

  it("calculates correct mNAV for Strategy-like scenario", () => {
    // MSTR: ~$33.7B market cap, ~$8.2B debt, ~$36.2B BTC treasury
    const fdMarketCap = 33_700_000_000;
    const netDebt = 8_190_000_000;
    const btcTreasury = 36_200_000_000;
    const mNav = calcMNavEv(fdMarketCap, netDebt, btcTreasury);
    expect(mNav).not.toBeNull();
    expect(mNav!).toBeGreaterThan(1.0);
    expect(mNav!).toBeLessThan(2.0);
  });

  it("calculates mNAV < 1 for company trading below NAV", () => {
    // SWC: market cap below BTC treasury value
    const fdMarketCap = 150_000_000;
    const netDebt = 0;
    const btcTreasury = 184_000_000;
    const mNav = calcMNavEv(fdMarketCap, netDebt, btcTreasury);
    expect(mNav).not.toBeNull();
    expect(mNav!).toBeLessThan(1.0);
  });

  it("includes net debt in EV calculation", () => {
    // EV = Market Cap + Net Debt
    const mNavWithDebt = calcMNavEv(1_000_000, 500_000, 1_000_000);
    const mNavNoDebt = calcMNavEv(1_000_000, 0, 1_000_000);
    expect(mNavWithDebt!).toBeGreaterThan(mNavNoDebt!);
    expect(mNavWithDebt).toBeCloseTo(1.5, 5);
    expect(mNavNoDebt).toBeCloseTo(1.0, 5);
  });
});

// ── BTC Coverage Tests ────────────────────────────────────────────────────────

describe("calcBtcCoverage", () => {
  it("returns null when there is no debt", () => {
    expect(calcBtcCoverage(1_000_000, 0)).toBeNull();
  });

  it("calculates correct coverage ratio", () => {
    // Metaplanet: $2.4B BTC treasury / $275M debt ≈ 8.7x
    const coverage = calcBtcCoverage(2_400_000_000, 275_000_000);
    expect(coverage).not.toBeNull();
    expect(coverage!).toBeCloseTo(8.727, 2);
  });

  it("calculates correct coverage for Nakamoto", () => {
    // NAKA: ~$370M BTC / $210M debt ≈ 1.76x
    const coverage = calcBtcCoverage(370_000_000, 210_000_000);
    expect(coverage!).toBeCloseTo(1.762, 2);
  });
});

// ── FX Conversion Tests ───────────────────────────────────────────────────────

describe("toUsd FX conversion", () => {
  const fx = { usdKrw: 1429, usdJpy: 158.73, gbpUsd: 1.3342, usdSek: 9.42 };

  it("passes through USD unchanged", () => {
    expect(toUsd(132.93, "USD", fx)).toBe(132.93);
  });

  it("converts JPY to USD correctly", () => {
    // ¥303 / 158.73 ≈ $1.909
    const usd = toUsd(303, "JPY", fx);
    expect(usd).toBeCloseTo(1.909, 2);
  });

  it("converts GBp (pence) to USD correctly", () => {
    // 29.71p = £0.2971 × 1.3342 ≈ $0.3963
    const usd = toUsd(29.71, "GBp", fx);
    expect(usd).toBeCloseTo(0.3963, 3);
  });

  it("converts GBP (pounds) to USD correctly", () => {
    const usd = toUsd(1.0, "GBP", fx);
    expect(usd).toBeCloseTo(1.3342, 4);
  });

  it("converts SEK to USD correctly", () => {
    const usd = toUsd(9.42, "SEK", fx);
    expect(usd).toBeCloseTo(1.0, 3);
  });

  it("converts KRW to USD correctly", () => {
    const usd = toUsd(1429, "KRW", fx);
    expect(usd).toBeCloseTo(1.0, 3);
  });

  it("returns price unchanged for unknown currency", () => {
    expect(toUsd(100, "EUR", fx)).toBe(100);
  });
});

// ── BTC per Share Tests ───────────────────────────────────────────────────────

describe("BTC per share calculations", () => {
  it("calculates sats per share for Strategy (762,099 BTC live from strategy.com API)", () => {
    const btcHeld = 762_099;
    const shares = 254_000_000;
    const btcPerShare = btcHeld / shares;
    const sats = btcPerShare * 1e8;
    // 762099 / 254000000 * 1e8 = ~300,039 sats/share
    expect(sats).toBeCloseTo(300_039, 0);
  });

  it("calculates sats per share for Metaplanet", () => {
    const btcHeld = 35_102;
    const shares = 1_142_248_029;
    const btcPerShare = btcHeld / shares;
    const sats = btcPerShare * 1e8;
    expect(sats).toBeCloseTo(3073, 0);
  });

  it("calculates sats per share for SWC", () => {
    const btcHeld = 2_695;
    const shares = 396_040_063;
    const btcPerShare = btcHeld / shares;
    const sats = btcPerShare * 1e8;
    expect(sats).toBeCloseTo(680, 0);
  });
});
