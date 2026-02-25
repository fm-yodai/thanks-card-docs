import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DocumentStore } from "../lib/document-store.js";

export function registerGetDocument(
  server: McpServer,
  store: DocumentStore,
): void {
  server.tool(
    "get_document",
    "指定されたドキュメントの全文（Markdown）を返します。nameパラメータにはlist_documentsで取得したドキュメント名（拡張子なし）を指定してください。",
    {
      name: z.string().describe('ドキュメント名（拡張子なし、例: "requirements"）'),
    },
    async ({ name }) => {
      const doc = await store.getDocument(name);
      if (!doc) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `ドキュメント "${name}" が見つかりません。list_documentsで利用可能なドキュメント名を確認してください。`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: doc.content,
          },
        ],
      };
    },
  );
}
