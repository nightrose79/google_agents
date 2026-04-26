# iBonds MCP Server

An MCP (Model Context Protocol) server that brings the BlackRock iShares iBonds Ladder Tool into any MCP-compatible AI assistant.

## What it does

Replicates the core functionality of [BlackRock's iBonds Ladder Tool](https://www.blackrock.com/us/financial-professionals/tools/ibonds) as MCP tools, so you can build and analyze iBonds bond ladders conversationally.

## Tools

| Tool | Description |
|------|-------------|
| `ibonds_list_etfs` | List all iBonds ETFs filtered by bond type and/or maturity year |
| `ibonds_get_quote` | Fetch live NAV, YTM, duration, AUM for specific tickers |
| `ibonds_build_ladder` | Build a complete bond ladder with allocations and visual chart |
| `ibonds_compare_types` | Compare corporate vs muni vs treasury vs TIPS for a given year |
| `ibonds_cashflow_projection` | Project annual income + principal repayment over the ladder's life |

## Supported Bond Types

- **Corporate** — Investment Grade (IBDP–IBDY)
- **Municipal** — Federal-tax-exempt (IBMJ–IBMR)
- **Treasury** — US Treasury (IBTE–IBTN)
- **TIPS** — Inflation-Protected (IBIP–IBIT2)

## Ladder Strategies

- `equal` — Uniform allocation across all rungs
- `ascending` — More weight on later maturities
- `descending` — More weight on earlier maturities
- `barbell` — Concentrated at short and long ends
- `bullet` — All weight on a single maturity year

## Installation

```bash
npm install
npm run build
```

## Running

### stdio (for Claude Desktop / local MCP clients)

```bash
npm start
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ibonds": {
      "command": "node",
      "args": ["/path/to/ibonds-mcp-server/dist/index.js"]
    }
  }
}
```

### HTTP (for remote / multi-client deployments)

```bash
TRANSPORT=http PORT=3000 npm start
```

MCP endpoint: `http://localhost:3000/mcp`

## Example Prompts

Once connected to an MCP client:

> "Build me a 5-year investment grade corporate bond ladder with $500,000 starting in 2027, equal weighted"

> "Compare municipal vs corporate iBonds maturing in 2029 for a client in the 37% tax bracket"

> "Show me the projected cash flows from a $300,000 barbell treasury ladder from 2026 to 2033"

## Disclaimer

Data sourced from iShares/BlackRock public APIs. May be delayed. This is not investment advice. Always verify data at [blackrock.com](https://www.blackrock.com/us/financial-professionals/tools/ibonds).
