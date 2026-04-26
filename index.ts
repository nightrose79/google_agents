import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { registerTools } from "./tools/ibonds.js";

const server = new McpServer({
  name: "ibonds-mcp-server",
  version: "1.0.0",
});

registerTools(server);

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check — used by Railway and Claude.ai to verify the server is up
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "ibonds-mcp-server", version: "1.0.0" });
  });

  // MCP Streamable HTTP — POST handles all JSON-RPC calls
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp — required by some MCP clients for capability discovery
  app.get("/mcp", (_req, res) => {
    res.status(200).json({
      name: "ibonds-mcp-server",
      version: "1.0.0",
      transport: "streamable-http",
      endpoint: "/mcp",
    });
  });

  // DELETE /mcp — required by MCP clients for session cleanup
  app.delete("/mcp", (_req, res) => {
    res.status(200).json({ status: "session closed" });
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, "0.0.0.0", () => {
    console.error(`iBonds MCP server running on http://0.0.0.0:${port}/mcp`);
  });
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("iBonds MCP server running on stdio");
}

// Default to HTTP in production (Railway sets NODE_ENV=production)
const transportMode = process.env.TRANSPORT ?? (process.env.NODE_ENV === "production" ? "http" : "stdio");
if (transportMode === "http") {
  runHTTP().catch(err => { console.error("Server error:", err); process.exit(1); });
} else {
  runStdio().catch(err => { console.error("Server error:", err); process.exit(1); });
}
