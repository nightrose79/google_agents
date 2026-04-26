// iShares ETF data service – fetches live NAV, yield, and fund data from BlackRock/iShares public APIs
import { IBondsETF } from "../constants.js";

export interface ETFQuote {
  ticker: string;
  name: string;
  nav: number | null;
  marketPrice: number | null;
  ytm: number | null;          // yield to maturity %
  distributionYield: number | null;
  expenseRatio: number | null; // %
  totalAssets: number | null;  // $M
  duration: number | null;     // years
  creditQuality: string | null;
  maturityYear: number;
  isinOrCusip: string | null;
  lastUpdated: string;
  productUrl: string;
}

export interface ETFQuoteError {
  ticker: string;
  error: string;
}

const ISHARES_FUND_API = "https://www.ishares.com/us/products";

/**
 * Fetch live ETF data from iShares public overview JSON.
 * The iShares product page embeds a JSON data blob we can parse.
 */
export async function fetchETFQuote(etf: IBondsETF): Promise<ETFQuote | ETFQuoteError> {
  const url = `${ISHARES_FUND_API}/${etf.productPageId}/1467271812596.ajax?tab=overview&fileType=json`;
  const productUrl = `${ISHARES_FUND_API}/${etf.productPageId}/${etf.ticker.toLowerCase()}-ishares-${etf.bondType === "corporate" ? "ibonds-dec-" + etf.maturityYear + "-term-corporate-etf" : "ibonds-" + etf.maturityYear}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ibonds-mcp/1.0)",
        "Referer": `https://www.blackrock.com/us/financial-professionals/tools/ibonds`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // Fall back to known static data if API is unavailable
      return buildFallbackQuote(etf);
    }

    const data = await res.json() as Record<string, unknown>;
    return parseIShaesOverviewJson(data, etf, productUrl);
  } catch {
    return buildFallbackQuote(etf);
  }
}

function parseIShaesOverviewJson(
  data: Record<string, unknown>,
  etf: IBondsETF,
  productUrl: string
): ETFQuote {
  const safe = (obj: unknown, ...keys: string[]): unknown => {
    let cur: unknown = obj;
    for (const k of keys) {
      if (cur === null || typeof cur !== "object") return null;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur ?? null;
  };

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "-" || v === "N/A") return null;
    const n = parseFloat(String(v).replace(/[,%$]/g, ""));
    return isNaN(n) ? null : n;
  };

  const fundData = safe(data, "fundData") as Record<string, unknown> | null;

  return {
    ticker: etf.ticker,
    name: etf.name,
    nav: toNum(safe(data, "navPrice") ?? safe(fundData, "navPrice")),
    marketPrice: toNum(safe(data, "marketPrice") ?? safe(fundData, "marketPrice")),
    ytm: toNum(safe(data, "yieldToMaturity") ?? safe(fundData, "yieldToMaturity")),
    distributionYield: toNum(safe(data, "distributionYield") ?? safe(fundData, "distributionYield")),
    expenseRatio: toNum(safe(data, "netExpenseRatio") ?? safe(fundData, "netExpenseRatio")),
    totalAssets: toNum(safe(data, "totalNetAssets") ?? safe(fundData, "totalNetAssets")),
    duration: toNum(safe(data, "effectiveDuration") ?? safe(fundData, "effectiveDuration")),
    creditQuality: null,
    maturityYear: etf.maturityYear,
    isinOrCusip: etf.cusip ?? null,
    lastUpdated: new Date().toISOString(),
    productUrl: `https://www.blackrock.com/us/individual/products/${etf.productPageId}`,
  };
}

/** Returns a quote with null market data when the API is unavailable */
function buildFallbackQuote(etf: IBondsETF): ETFQuote {
  return {
    ticker: etf.ticker,
    name: etf.name,
    nav: null,
    marketPrice: null,
    ytm: null,
    distributionYield: null,
    expenseRatio: null,
    totalAssets: null,
    duration: null,
    creditQuality: null,
    maturityYear: etf.maturityYear,
    isinOrCusip: etf.cusip ?? null,
    lastUpdated: new Date().toISOString(),
    productUrl: `https://www.blackrock.com/us/individual/products/${etf.productPageId}`,
  };
}

/** Fetch multiple ETF quotes in parallel */
export async function fetchMultipleQuotes(etfs: IBondsETF[]): Promise<(ETFQuote | ETFQuoteError)[]> {
  return Promise.all(etfs.map(fetchETFQuote));
}

export function isETFQuote(q: ETFQuote | ETFQuoteError): q is ETFQuote {
  return !("error" in q);
}
