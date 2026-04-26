// Bond ladder calculation engine
import { BondType } from "../constants.js";
import { ETFQuote } from "../services/ishares.js";

export interface LadderRung {
  maturityYear: number;
  ticker: string;
  name: string;
  allocation: number;         // $ amount
  allocationPct: number;      // % of total
  shares: number | null;      // estimated shares at NAV
  ytm: number | null;
  distributionYield: number | null;
  expenseRatio: number | null;
  marketPrice: number | null;
  nav: number | null;
  totalAssets: number | null;
  duration: number | null;
  productUrl: string;
}

export interface LadderResult {
  bondType: BondType;
  startYear: number;
  endYear: number;
  totalInvestment: number;
  weightingStrategy: WeightingStrategy;
  rungs: LadderRung[];
  summary: LadderSummary;
  warnings: string[];
  generatedAt: string;
}

export interface LadderSummary {
  numRungs: number;
  weightedAvgYTM: number | null;        // blended YTM across rungs
  weightedAvgDuration: number | null;   // blended duration
  avgExpenseRatio: number | null;
  estimatedAnnualIncome: number | null; // $ based on dist yield
  totalYearsSpan: number;
}

export type WeightingStrategy = "equal" | "bullet" | "barbell" | "ascending" | "descending";

export interface LadderBuildParams {
  quotes: ETFQuote[];
  totalInvestment: number;
  strategy: WeightingStrategy;
  bulletYear?: number;    // for bullet strategy
}

/** Build allocation weights based on strategy */
export function buildWeights(
  years: number[],
  strategy: WeightingStrategy,
  bulletYear?: number
): Map<number, number> {
  const weights = new Map<number, number>();
  const n = years.length;
  if (n === 0) return weights;

  switch (strategy) {
    case "equal": {
      years.forEach(y => weights.set(y, 1 / n));
      break;
    }
    case "ascending": {
      // Later maturities get higher weight
      const total = years.reduce((s, _, i) => s + (i + 1), 0);
      years.forEach((y, i) => weights.set(y, (i + 1) / total));
      break;
    }
    case "descending": {
      // Earlier maturities get higher weight
      const total = years.reduce((s, _, i) => s + (n - i), 0);
      years.forEach((y, i) => weights.set(y, (n - i) / total));
      break;
    }
    case "barbell": {
      // Concentrate at short and long ends
      const shortEnd = years.slice(0, Math.ceil(n / 3));
      const longEnd = years.slice(Math.floor((2 * n) / 3));
      const middle = years.slice(Math.ceil(n / 3), Math.floor((2 * n) / 3));
      years.forEach(y => {
        if (shortEnd.includes(y) || longEnd.includes(y)) {
          weights.set(y, 0.4 / (shortEnd.length + longEnd.length));
        } else {
          weights.set(y, 0.2 / (middle.length || 1));
        }
      });
      // Normalize
      const sum = Array.from(weights.values()).reduce((a, b) => a + b, 0);
      weights.forEach((v, k) => weights.set(k, v / sum));
      break;
    }
    case "bullet": {
      if (bulletYear !== undefined && years.includes(bulletYear)) {
        years.forEach(y => weights.set(y, y === bulletYear ? 1 : 0));
      } else {
        // fallback to equal if bullet year not found
        years.forEach(y => weights.set(y, 1 / n));
      }
      break;
    }
  }
  return weights;
}

export function buildLadder(params: LadderBuildParams): LadderResult {
  const { quotes, totalInvestment, strategy, bulletYear } = params;

  const sortedQuotes = [...quotes].sort((a, b) => a.maturityYear - b.maturityYear);
  const years = sortedQuotes.map(q => q.maturityYear);
  const weights = buildWeights(years, strategy, bulletYear);
  const warnings: string[] = [];

  const rungs: LadderRung[] = sortedQuotes.map(q => {
    const weight = weights.get(q.maturityYear) ?? 0;
    const allocation = totalInvestment * weight;
    const shares = q.nav && q.nav > 0 ? Math.floor(allocation / q.nav) : null;

    return {
      maturityYear: q.maturityYear,
      ticker: q.ticker,
      name: q.name,
      allocation: Math.round(allocation * 100) / 100,
      allocationPct: Math.round(weight * 10000) / 100,
      shares,
      ytm: q.ytm,
      distributionYield: q.distributionYield,
      expenseRatio: q.expenseRatio,
      marketPrice: q.marketPrice,
      nav: q.nav,
      totalAssets: q.totalAssets,
      duration: q.duration,
      productUrl: q.productUrl,
    };
  });

  // Compute weighted averages (only where data is available)
  const rungsWithYTM = rungs.filter(r => r.ytm !== null && r.allocationPct > 0);
  const rungsWithDur = rungs.filter(r => r.duration !== null && r.allocationPct > 0);
  const rungsWithER = rungs.filter(r => r.expenseRatio !== null);
  const rungsWithDY = rungs.filter(r => r.distributionYield !== null && r.allocationPct > 0);

  const weightedAvgYTM = rungsWithYTM.length
    ? rungsWithYTM.reduce((s, r) => s + (r.ytm! * r.allocationPct) / 100, 0)
    : null;

  const weightedAvgDuration = rungsWithDur.length
    ? rungsWithDur.reduce((s, r) => s + (r.duration! * r.allocationPct) / 100, 0)
    : null;

  const avgExpenseRatio = rungsWithER.length
    ? rungsWithER.reduce((s, r) => s + r.expenseRatio!, 0) / rungsWithER.length
    : null;

  const estimatedAnnualIncome = rungsWithDY.length
    ? rungsWithDY.reduce((s, r) => s + (r.allocation * r.distributionYield!) / 100, 0)
    : null;

  if (rungsWithYTM.length === 0) {
    warnings.push("Live yield data unavailable — market data may be delayed. Please verify on BlackRock's website.");
  }

  const bondType = sortedQuotes[0]
    ? (sortedQuotes[0].ticker.startsWith("IBM") ? "muni" :
       sortedQuotes[0].ticker.startsWith("IBT") ? "treasury" :
       sortedQuotes[0].ticker.startsWith("IBI") ? "tips" : "corporate")
    : "corporate";

  return {
    bondType: bondType as BondType,
    startYear: years[0] ?? new Date().getFullYear(),
    endYear: years[years.length - 1] ?? new Date().getFullYear(),
    totalInvestment,
    weightingStrategy: strategy,
    rungs,
    summary: {
      numRungs: rungs.length,
      weightedAvgYTM: weightedAvgYTM !== null ? Math.round(weightedAvgYTM * 100) / 100 : null,
      weightedAvgDuration: weightedAvgDuration !== null ? Math.round(weightedAvgDuration * 100) / 100 : null,
      avgExpenseRatio: avgExpenseRatio !== null ? Math.round(avgExpenseRatio * 10000) / 10000 : null,
      estimatedAnnualIncome: estimatedAnnualIncome !== null ? Math.round(estimatedAnnualIncome * 100) / 100 : null,
      totalYearsSpan: (years[years.length - 1] ?? 0) - (years[0] ?? 0) + 1,
    },
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

/** Format a ladder result as a rich markdown table with ASCII bar chart */
export function formatLadderMarkdown(ladder: LadderResult): string {
  const { rungs, summary, warnings, bondType, totalInvestment, weightingStrategy } = ladder;
  const fmt$ = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number | null) => n !== null ? `${n.toFixed(2)}%` : "N/A";

  const lines: string[] = [
    `# iBonds Bond Ladder — ${bondType.toUpperCase()}`,
    ``,
    `**Total Investment:** ${fmt$(totalInvestment)}  |  **Years:** ${ladder.startYear}–${ladder.endYear}  |  **Strategy:** ${weightingStrategy}`,
    ``,
    `## Ladder Rungs`,
    ``,
    `| Year | Ticker | Allocation | % | YTM | Dist. Yield | ER | Est. Shares |`,
    `|------|--------|-----------|---|-----|-------------|-----|-------------|`,
  ];

  rungs.forEach(r => {
    lines.push(
      `| ${r.maturityYear} | **${r.ticker}** | ${fmt$(r.allocation)} | ${r.allocationPct}% | ${fmtPct(r.ytm)} | ${fmtPct(r.distributionYield)} | ${fmtPct(r.expenseRatio)} | ${r.shares ?? "N/A"} |`
    );
  });

  // ASCII bar chart of allocations
  lines.push(``, `## Allocation Visualizer`, ``);
  const maxAlloc = Math.max(...rungs.map(r => r.allocation));
  const barWidth = 30;
  rungs.forEach(r => {
    const bars = Math.round((r.allocation / maxAlloc) * barWidth);
    const bar = "█".repeat(bars) + "░".repeat(barWidth - bars);
    lines.push(`${r.maturityYear}  ${bar}  ${fmt$(r.allocation)} (${r.allocationPct}%)`);
  });

  lines.push(``, `## Portfolio Summary`, ``);
  lines.push(`- **Rungs:** ${summary.numRungs}`);
  lines.push(`- **Blended YTM:** ${fmtPct(summary.weightedAvgYTM)}`);
  lines.push(`- **Blended Duration:** ${summary.weightedAvgDuration !== null ? summary.weightedAvgDuration.toFixed(2) + " yrs" : "N/A"}`);
  lines.push(`- **Avg Expense Ratio:** ${fmtPct(summary.avgExpenseRatio)}`);
  lines.push(`- **Est. Annual Income:** ${summary.estimatedAnnualIncome !== null ? fmt$(summary.estimatedAnnualIncome) : "N/A"}`);

  if (warnings.length > 0) {
    lines.push(``, `## ⚠️ Warnings`, ``);
    warnings.forEach(w => lines.push(`- ${w}`));
  }

  lines.push(``, `---`, `*Data sourced from iShares/BlackRock. Not investment advice. Verify details at blackrock.com.*`);

  return lines.join("\n");
}
