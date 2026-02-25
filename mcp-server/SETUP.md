# thanks-card-docs MCP サーバー セットアップ手順書

ありがとうカードプロジェクトのドキュメントを AI エージェントに提供する MCP (Model Context Protocol) サーバーです。npm パッケージとして配布されており、リポジトリのクローンは不要です。

## 概要

このサーバーはプロジェクトドキュメントを内蔵しており、以下の 3 つのツールを AI に提供します。

| ツール名 | 説明 |
|---|---|
| `list_documents` | ドキュメント一覧（タイトル・説明・推奨対象）を返す |
| `get_document` | 指定ドキュメントの全文を返す |
| `search_documents` | 全ドキュメントを横断してキーワード検索する |

## 前提条件

- **Node.js** v18 以上

## セットアップ手順

### Claude Code

プロジェクトルートの `.mcp.json` を作成または編集します。

```json
{
  "mcpServers": {
    "thanks-card-docs": {
      "command": "npx",
      "args": ["-y", "thanks-card-docs-mcp"]
    }
  }
}
```

設定後、Claude Code を再起動すれば利用可能です。

### Claude Desktop

設定ファイルに追加します。

- Linux: `~/.config/claude/claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "thanks-card-docs": {
      "command": "npx",
      "args": ["-y", "thanks-card-docs-mcp"]
    }
  }
}
```

### HTTP モード

リモートマシンやコンテナ環境では Streamable HTTP トランスポートで起動できます。

```bash
npx -y thanks-card-docs-mcp --http
```

デフォルトでは `http://localhost:3000/mcp` でリクエストを受け付けます。ポートを変更するには:

```bash
PORT=8080 npx -y thanks-card-docs-mcp --http
```

## ドキュメントの更新

ドキュメントが更新された場合、新しいバージョンを publish するだけで利用者側の作業は不要です。`npx` が自動的に最新版を取得します。

```bash
# メンテナー向け: ドキュメント更新時の publish 手順
cd mcp-server
npm version patch
npm publish
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|---|---|---|
| `DOCS_PATH` | ドキュメントディレクトリのパスを上書き | パッケージ内蔵の `ai-context/` |
| `PORT` | HTTP モード時のポート番号 | `3000` |
| `MCP_TRANSPORT` | `http` を指定すると HTTP モードで起動 | （未設定 = stdio） |

## 開発者向け（リポジトリから直接実行）

```bash
git clone <リポジトリURL>
cd thanks-card-docs/mcp-server
npm install
npm run build
npm start
```

TypeScript のウォッチモード:

```bash
npm run dev
```

## トラブルシューティング

### `npx` で起動に失敗する

Node.js v18 以上がインストールされているか確認してください。

```bash
node --version
```

### ドキュメントが見つからない

`DOCS_PATH` を設定している場合:
- 指定パスが存在するか確認
- ディレクトリ内に `.md` ファイルがあるか確認

### HTTP モードで接続できない

- ファイアウォールでポートが開いているか確認
- エンドポイントは `/mcp` であることに注意（`http://localhost:3000/mcp`）
