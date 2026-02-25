import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DocumentStore } from "../lib/document-store.js";

export function registerSearchDocuments(
  server: McpServer,
  store: DocumentStore,
): void {
  server.tool(
    "search_documents",
    "全ドキュメントを横断検索します。クエリの各単語でOR検索を行い、マッチした箇所のdocument_name, section, snippetを返します。",
    {
      query: z.string().describe("検索クエリ（スペース区切りでOR検索）"),
    },
    async ({ query }) => {
      const results = await store.searchDocuments(query);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `"${query}" に一致するドキュメントは見つかりませんでした。`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
