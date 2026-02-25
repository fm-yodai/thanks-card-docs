import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DocumentStore } from "../lib/document-store.js";

export function registerListDocuments(
  server: McpServer,
  store: DocumentStore,
): void {
  server.tool(
    "list_documents",
    "プロジェクトドキュメントの一覧を返します。各ドキュメントのname, title, description, recommended_forを含みます。AIが何を取得すべきか判断するための目次として使用してください。",
    async () => {
      const docs = await store.listDocuments();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(docs, null, 2),
          },
        ],
      };
    },
  );
}
