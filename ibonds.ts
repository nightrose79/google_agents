// MCP Tool definitions for iBonds Ladder
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IBONDS_CATALOG, BOND_TYPE_LABELS, BOND_TYPE_TAX_NOTE, type BondType } from "../constants.js";
import { fetchMultipleQuotes, isETFQuote, type ETFQuote } from "../services/ishares.js";
import { buildLadder, formatLadderMarkdown, type WeightingStrategy } from "../services/ladder.js";

const BondTypeSchema = z.enum(["corporate", "muni", "treasury", "tips"])
  .describe("Bond type: 'corporate' (inv-grade corp), 'muni' (municipal), 'treasury' (US Treas), 'tips' (inflation-protected)");

const WeightingSchema = z.enum(["equal", "ascending", "descending", "barbell", "bullet"])
  .describe("Allocation strategy: equal=uniform, ascending=more in later years, descending=more in earlier years, barbell=concentrate at ends, bullet=single maturity year");

export function registerTools(server: McpServer): void {

  // ─── Tool 1: List iBonds ETFs ──────────────────────────────────────────────
  server.registerTool(
    "ibonds_list_etfs",
    {
      title: "List iBonds ETFs",
      description: `List all available iShares iBonds ETFs filtered by bond type and/or maturity year range.

Returns the catalog of iBonds ETFs with their tickers, names, maturity years, and product URLs.

Args:
  - bond_type (optional): Filter by bond type (corporate, muni, treasury, tips)
  - start_year (optional): Earliest maturity year to include (e.g. 2025)
  - end_year (optional): Latest maturity year to include (e.g. 2034)

Returns JSON array of ETF catalog entries.`,
      inputSchema: z.object({
        bond_type: BondTypeSchema.optional(),
        start_year: z.number().int().min(2025).max(2040).optional()
          .describe("Earliest maturity year to include"),
        end_year: z.number().int().min(2025).max(2040).optional()
          .describe("Latest maturity year to include"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ bond_type, start_year, end_year }) => {
      let etfs = IBONDS_CATALOG;
      if (bond_type) etfs = etfs.filter(e => e.bondType === bond_type);
      if (start_year) etfs = etfs.filter(e => e.maturityYear >= start_year);
      if (end_year) etfs = etfs.filter(e => e.maturityYear <= end_year);

      const result = etfs.map(e => ({
        ticker: e.ticker,
        name: e.name,
        maturityYear: e.maturityYear,
        bondType: e.bondType,
        bondTypeLabel: BOND_TYPE_LABELS[e.bondType],
        taxNote: BOND_TYPE_TAX_NOTE[e.bondType],
        productUrl: `https://www.blackrock.com/us/individual/products/${e.productPageId}`,
      }));

      const markdown = [
        `## iBonds ETF Catalog (${result.length} funds)`,
        ``,
        `| Ticker | Maturity | Type | Name |`,
        `|--------|----------|------|------|`,
        ...result.map(e => `| **${e.ticker}** | ${e.maturityYear} | ${e.bondType} | ${e.name} |`),
      ].join("\n");

      return {
        content: [{ type: "text", text: markdown }],
        structuredContent: { etfs: result, count: result.length },
      };
    }
  );

  // ─── Tool 2: Get ETF Quote ─────────────────────────────────────────────────
  server.registerTool(
    "ibonds_get_quote",
    {
      title: "Get iBonds ETF Quote",
      description: `Fetch live market data for one or more iShares iBonds ETFs including NAV, yield-to-maturity, distribution yield, expense ratio, duration, and total assets.

Args:
  - tickers: Array of iBonds ETF tickers (e.g. ["IBDR", "IBDS", "IBDT"])

Returns live quote data per ticker. Data may be delayed; verify on BlackRock's website.

Examples:
  - Get quote for IBDR: { tickers: ["IBDR"] }
  - Get quotes for a 3-year corporate ladder: { tickers: ["IBDR", "IBDS", "IBDT"] }`,
      inputSchema: z.object({
        tickers: z.array(z.string().min(3).max(6)).min(1).max(15)
          .describe("Array of iBonds ETF tickers, e.g. ['IBDR', 'IBDS']"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ tickers }) => {
      const upperTickers = tickers.map(t => t.toUpperCase());
      const etfs = IBONDS_CATALOG.filter(e => upperTickers.includes(e.ticker));

      const notFound = upperTickers.filter(t => !IBONDS_CATALOG.some(e => e.ticker === t));
      if (etfs.length === 0) {
        return {
          content: [{ type: "text", text: `No matching iBonds ETFs found for: ${notFound.join(", ")}` }],
        };
      }

      const quotes = await fetchMultipleQuotes(etfs);
      const valid = quotes.filter(isETFQuote) as ETFQuote[];

      const fmtPct = (n: number | null) => n !== null ? `${n.toFixed(3)}%` : "N/A";
      const fmtPrice = (n: number | null) => n !== null ? `$${n.toFixed(2)}` : "N/A";
      const fmtAUM = (n: number | null) => n !== null ? `$${(n / 1e6).toFixed(1)}M` : "N/A";

      const rows = valid.map(q =>
        `| **${q.ticker}** | ${q.maturityYear} | ${fmtPrice(q.nav)} | ${fmtPrice(q.marketPrice)} | ${fmtPct(q.ytm)} | ${fmtPct(q.distributionYield)} | ${fmtPct(q.expenseRatio)} | ${q.duration?.toFixed(2) ?? "N/A"} yr | ${fmtAUM(q.totalAssets)} |`
      );

      const markdown = [
        `## iBonds ETF Quotes`,
        ``,
        `| Ticker | Maturity | NAV | Mkt Price | YTM | Dist. Yield | ER | Duration | AUM |`,
        `|--------|----------|-----|-----------|-----|-------------|-----|----------|-----|`,
        ...rows,
        ``,
        notFound.length > 0 ? `*Tickers not found: ${notFound.join(", ")}*` : "",
        ``,
        `*Data from iShares/BlackRock. May be delayed. Not investment advice.*`,
      ].join("\n");

      return {
        content: [{ type: "text", text: markdown }],
        structuredContent: { quotes: valid, notFound },
      };
    }
  );

  // ─── Tool 3: Build Bond Ladder ─────────────────────────────────────────────
  server.registerTool(
    "ibonds_build_ladder",
    {
      title: "Build iBonds Bond Ladder",
      description: `Build a bond ladder using iShares iBonds ETFs. Calculates allocations, fetches live quotes, and returns a complete ladder with visual allocation chart.

Args:
  - bond_type: Type of bonds for the ladder (corporate, muni, treasury, tips)
  - total_investment: Total dollar amount to invest (e.g. 100000)
  - start_year: First maturity year of the ladder (e.g. 2026)
  - end_year: Last maturity year of the ladder (e.g. 2032)
  - strategy: Allocation weighting (equal, ascending, descending, barbell, bullet)
  - bullet_year (optional): When strategy='bullet', the single target maturity year

Returns complete ladder with per-rung allocations, blended YTM, estimated income, ASCII bar chart, and summary statistics.

Examples:
  - Equal-weighted 5-yr corporate ladder: { bond_type: "corporate", total_investment: 500000, start_year: 2027, end_year: 2031, strategy: "equal" }
  - Barbell treasury ladder: { bond_type: "treasury", total_investment: 250000, start_year: 2026, end_year: 2033, strategy: "barbell" }
  - Muni ladder for tax-exempt income: { bond_type: "muni", total_investment: 300000, start_year: 2026, end_year: 2030, strategy: "equal" }`,
      inputSchema: z.object({
        bond_type: BondTypeSchema,
        total_investment: z.number().positive().min(1000).max(1e9)
          .describe("Total dollar amount to invest across the ladder"),
        start_year: z.number().int().min(2025).max(2039)
          .describe("First maturity year of the ladder"),
        end_year: z.number().int().min(2025).max(2040)
          .describe("Last maturity year of the ladder (inclusive)"),
        strategy: WeightingSchema.default("equal"),
        bullet_year: z.number().int().min(2025).max(2040).optional()
          .describe("For bullet strategy only: the single target maturity year"),
      }).strict().refine(d => d.end_year >= d.start_year, {
        message: "end_year must be >= start_year",
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ bond_type, total_investment, start_year, end_year, strategy, bullet_year }) => {
      const targetEtfs = IBONDS_CATALOG.filter(
        e => e.bondType === (bond_type as BondType) &&
          e.maturityYear >= start_year &&
          e.maturityYear <= end_year
      );

      if (targetEtfs.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No iBonds ETFs found for bond_type="${bond_type}" between ${start_year}–${end_year}. Try a different range or bond type.`,
          }],
        };
      }

      const rawQuotes = await fetchMultipleQuotes(targetEtfs);
      const quotes = rawQuotes.filter(isETFQuote) as ETFQuote[];

      const ladder = buildLadder({
        quotes,
        totalInvestment: total_investment,
        strategy: strategy as WeightingStrategy,
        bulletYear: bullet_year,
      });

      const markdown = formatLadderMarkdown(ladder);

      return {
        content: [{ type: "text", text: markdown }],
        structuredContent: ladder as unknown as Record<string, unknown>,
      };
    }
  );

  // ─── Tool 4: Compare Bond Types ────────────────────────────────────────────
  server.registerTool(
    "ibonds_compare_types",
    {
      title: "Compare iBonds Bond Types",
      description: `Compare iBonds ETF yields and characteristics across bond types (corporate, muni, treasury, tips) for a given maturity year or range.

Useful for tax-adjusted yield comparisons (e.g. muni vs corporate) and selecting the right bond type for a client's tax bracket.

Args:
  - maturity_year: Specific maturity year to compare across types (e.g. 2028)
  - tax_bracket_pct (optional): Federal marginal tax rate % for tax-equivalent yield calc (e.g. 37.0)

Returns side-by-side comparison of available ETFs for that maturity year with tax-adjusted yields.`,
      inputSchema: z.object({
        maturity_year: z.number().int().min(2025).max(2040)
          .describe("The maturity year to compare across bond types"),
        tax_bracket_pct: z.number().min(0).max(50).optional()
          .describe("Client's federal marginal tax rate % for tax-equivalent muni yield (e.g. 37.0 for 37% bracket)"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ maturity_year, tax_bracket_pct }) => {
      const etfsForYear = IBONDS_CATALOG.filter(e => e.maturityYear === maturity_year);

      if (etfsForYear.length === 0) {
        return {
          content: [{ type: "text", text: `No iBonds ETFs found maturing in ${maturity_year}.` }],
        };
      }

      const rawQuotes = await fetchMultipleQuotes(etfsForYear);
      const quotes = rawQuotes.filter(isETFQuote) as ETFQuote[];

      const fmtPct = (n: number | null) => n !== null ? `${n.toFixed(3)}%` : "N/A";

      const rows = quotes.map(q => {
        const taxEqYield = (q.ytm !== null && tax_bracket_pct !== undefined && q.ticker.startsWith("IBM"))
          ? q.ytm / (1 - tax_bracket_pct / 100)
          : null;
        return {
          ticker: q.ticker,
          bondType: BOND_TYPE_LABELS[etfsForYear.find(e => e.ticker === q.ticker)!.bondType],
          taxNote: BOND_TYPE_TAX_NOTE[etfsForYear.find(e => e.ticker === q.ticker)!.bondType],
          ytm: q.ytm,
          distYield: q.distributionYield,
          expenseRatio: q.expenseRatio,
          taxEqYield,
          nav: q.nav,
          duration: q.duration,
          productUrl: q.productUrl,
        };
      });

      const lines = [
        `## iBonds Comparison — Maturity Year ${maturity_year}`,
        tax_bracket_pct ? `*Tax bracket: ${tax_bracket_pct}% (used for muni tax-equivalent yield)*` : "",
        ``,
        `| Ticker | Type | YTM | Dist. Yield | ER | Duration | NAV${tax_bracket_pct ? " | Tax-Eq YTM" : ""} |`,
        `|--------|------|-----|-------------|-----|----------|----${tax_bracket_pct ? "|------------|" : "|"}`,
        ...rows.map(r =>
          `| **${r.ticker}** | ${r.bondType} | ${fmtPct(r.ytm)} | ${fmtPct(r.distYield)} | ${fmtPct(r.expenseRatio)} | ${r.duration?.toFixed(2) ?? "N/A"} yr | ${r.nav ? `$${r.nav.toFixed(2)}` : "N/A"}${tax_bracket_pct ? ` | ${r.taxEqYield ? fmtPct(r.taxEqYield) : "—"}` : ""} |`
        ),
        ``,
        `## Tax Treatment`,
        ``,
        ...rows.map(r => `- **${r.ticker}**: ${r.taxNote}`),
        ``,
        `*Not investment advice. Verify current data at blackrock.com.*`,
      ];

      return {
        content: [{ type: "text", text: lines.filter(Boolean).join("\n") }],
        structuredContent: { maturityYear: maturity_year, comparison: rows, taxBracket: tax_bracket_pct ?? null },
      };
    }
  );

  // ─── Tool 5: Ladder Cash Flow Projection ──────────────────────────────────
  server.registerTool(
    "ibonds_cashflow_projection",
    {
      title: "iBonds Ladder Cash Flow Projection",
      description: `Project estimated annual cash flows (income + principal return at maturity) from an iBonds ladder over its life.

Args:
  - bond_type: Bond type for the ladder
  - total_investment: Total dollar amount invested
  - start_year: First maturity year
  - end_year: Last maturity year
  - strategy: Allocation weighting strategy

Returns year-by-year projected income (distribution yield * allocation) and maturity principal repayment per rung, with cumulative totals.`,
      inputSchema: z.object({
        bond_type: BondTypeSchema,
        total_investment: z.number().positive().min(1000).max(1e9),
        start_year: z.number().int().min(2025).max(2039),
        end_year: z.number().int().min(2025).max(2040),
        strategy: WeightingSchema.default("equal"),
      }).strict().refine(d => d.end_year >= d.start_year, { message: "end_year must be >= start_year" }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ bond_type, total_investment, start_year, end_year, strategy }) => {
      const targetEtfs = IBONDS_CATALOG.filter(
        e => e.bondType === (bond_type as BondType) &&
          e.maturityYear >= start_year && e.maturityYear <= end_year
      );

      if (targetEtfs.length === 0) {
        return { content: [{ type: "text", text: `No ETFs found for ${bond_type} ${start_year}–${end_year}.` }] };
      }

      const rawQuotes = await fetchMultipleQuotes(targetEtfs);
      const quotes = rawQuotes.filter(isETFQuote) as ETFQuote[];
      const ladder = buildLadder({ quotes, totalInvestment: total_investment, strategy: strategy as WeightingStrategy });

      const currentYear = new Date().getFullYear();
      const fmt$ = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
      const fmtPct = (n: number | null) => n !== null ? `${n.toFixed(2)}%` : "N/A";

      // Build per-year cash flow table
      const allYears = Array.from({ length: end_year - currentYear + 1 }, (_, i) => currentYear + i);
      const cashflows = allYears.map(yr => {
        let annualIncome = 0;
        let principalReturn = 0;
        ladder.rungs.forEach(rung => {
          if (rung.distributionYield !== null) {
            // Income accrues each year until maturity
            if (yr <= rung.maturityYear) {
              annualIncome += (rung.allocation * rung.distributionYield) / 100;
            }
          }
          if (yr === rung.maturityYear) {
            principalReturn += rung.allocation;
          }
        });
        return { year: yr, annualIncome: Math.round(annualIncome), principalReturn: Math.round(principalReturn), total: Math.round(annualIncome + principalReturn) };
      });

      const lines = [
        `## iBonds Ladder Cash Flow Projection`,
        `**Bond Type:** ${BOND_TYPE_LABELS[bond_type as BondType]}  |  **Investment:** ${fmt$(total_investment)}  |  **Strategy:** ${strategy}`,
        ``,
        `| Year | Est. Annual Income | Principal Return | Total Cash Flow |`,
        `|------|--------------------|-----------------|-----------------|`,
        ...cashflows.map(c => `| ${c.year}${c.year === currentYear ? " *(current)*" : ""} | ${fmt$(c.annualIncome)} | ${c.principalReturn > 0 ? fmt$(c.principalReturn) : "—"} | **${fmt$(c.total)}** |`),
        ``,
        `**Total Projected Returns:** ${fmt$(cashflows.reduce((s, c) => s + c.total, 0))}`,
        ``,
        `*Income estimates based on current distribution yields — actual distributions will vary.*`,
        `*Principal return at maturity is approximate (based on current allocation, not future NAV).*`,
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: { cashflows, ladder: ladder.summary, bondType: bond_type },
      };
    }
  );
}
