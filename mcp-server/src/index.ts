#!/usr/bin/env node

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { DocumentStore } from "./lib/document-store.js";
import { registerListDocuments } from "./tools/list-documents.js";
import { registerGetDocument } from "./tools/get-document.js";
import { registerSearchDocuments } from "./tools/search-documents.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDocsPath(): string {
  if (process.env.DOCS_PATH) {
    return resolve(process.env.DOCS_PATH);
  }
  // ai-context/ packaged alongside dist/ in the npm package
  return resolve(__dirname, "..", "ai-context");
}

function createMcpServer(store: DocumentStore): McpServer {
  const server = new McpServer({
    name: "thanks-card-docs-mcp",
    version: "1.0.0",
  });

  registerListDocuments(server, store);
  registerGetDocument(server, store);
  registerSearchDocuments(server, store);

  return server;
}

async function startStdio(store: DocumentStore): Promise<void> {
  const server = createMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp(store: DocumentStore): Promise<void> {
  const port = parseInt(process.env.PORT || "3000", 10);

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    // Handle session-based transport
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "POST") {
      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      const server = createMcpServer(store);
      await server.connect(transport);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(400);
    res.end("Bad Request: No valid session");
  });

  httpServer.listen(port, () => {
    console.error(`MCP HTTP server listening on http://localhost:${port}/mcp`);
  });
}

async function main(): Promise<void> {
  const docsPath = resolveDocsPath();
  const store = new DocumentStore(docsPath);
  await store.load();

  const useHttp =
    process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http";

  if (useHttp) {
    await startHttp(store);
  } else {
    await startStdio(store);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
