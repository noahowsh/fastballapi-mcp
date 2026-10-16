#!/usr/bin/env node
// FastballAPI over stdio, for MCP clients that launch a local process instead of
// connecting to a URL. It lists and calls the same tools as the hosted server
// at https://mcp.fastballapi.com/mcp, using your API key; nothing is computed locally.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.FASTBALLAPI_API_KEY;
if (!API_KEY) {
  console.error("FASTBALLAPI_API_KEY is required. Get a free key with 500 credits a month at https://fastballapi.com/signup");
  process.exit(1);
}
const URL_ = process.env.FASTBALLAPI_MCP_URL || "https://mcp.fastballapi.com/mcp";

const client = new Client({ name: "fastballapi-stdio", version: "1.1.6" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(URL_), { requestInit: { headers: { "x-api-key": API_KEY } } }));
} catch (err) {
  // The hosted server says what is wrong with the key; print that, not a stack trace.
  const text = String(err?.message ?? err);
  const reason = text.match(/"error":"([^"]+)"/)?.[1] ?? text;
  console.error(`Could not connect to FastballAPI at ${URL_}: ${reason}`);
  process.exit(1);
}

const server = new Server({ name: "fastballapi", version: "1.1.6" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => client.listTools());
server.setRequestHandler(CallToolRequestSchema, async (request) =>
  client.callTool({ name: request.params.name, arguments: request.params.arguments }),
);

await server.connect(new StdioServerTransport());
