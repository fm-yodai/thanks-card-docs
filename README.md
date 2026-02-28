# ありがとうカード プロジェクト ドキュメント

FREEMIND社の社内感謝カードWebアプリ「ありがとうカード」プロジェクトのドキュメントサイトです。
プロジェクトの企画・設計・開発に関する資料をまとめています。

> **Note:** このリポジトリはドキュメントのみを管理しています。アプリケーション本体は別リポジトリです。

## このリポジトリに置くもの・置かないもの

| 置くもの | 置かないもの |
|---------|-------------|
| プロジェクト概要・ビジョン（インセプションデッキなど） | API仕様・DB設計などの技術ドキュメント（アプリリポジトリへ） |
| チーム体制・役割分担 | プロジェクト管理チケット・バックログ（管理ツールへ） |
| 開発プロセスのガイド・テンプレート | 議事録・日報・個人の作業ログ |
| コンピテンシー定義・社内方針 | コードレビュー記録・PR説明 |
| スプリントごとの企画・デザイン資料 | テスト仕様書・リリースノート（アプリリポジトリへ） |
| デザインガイドライン・デザインシステム | 一時的なメモ・下書き |

**判断基準:** 「プロジェクトの全体像を俯瞰するために必要か？」 — Yes ならこのリポジトリ、No ならより適切な場所へ。

## AIを使ったページ作成（推奨フロー）

このリポジトリのドキュメントは、生成AI（Claude Code、GitHub Copilot、ChatGPT、Claude など）を使って作成できます。以下のフローを推奨します。

### フロー

```
1. 要件を伝える   → 作りたいページの内容・目的をAIに伝える
2. 質問で明確化    → AIに不明点を質問させ、要件を固める
3. 生成           → 要件が固まったらページを生成させる
4. レビュー・修正  → 出力を確認し、フィードバックで調整する
5. 仕上げ         → documents.jsonへの追加・ビルド・スキル参照の検討
```

### プロンプトのコツ

**1. 最初に背景と目的を伝える**

```
ありがとうカードプロジェクトの「〇〇」に関するドキュメントページを作成してください。
目的: △△を共有するため
対象読者: □□
```

**2. 不明点を質問するよう指示する**

```
作成に入る前に、不明点があれば質問してください。
```

こうすることで、AIが要件の曖昧な部分を洗い出してくれます。やりとりで認識を合わせてから生成に入ると、手戻りが減ります。

**3. 既存ページを参考にさせる**

```
docs/kickoff.html のようなプレゼン形式で作成してください。
```

既存ページを指定すると、デザインやトーンが揃いやすくなります。主な形式:

| 形式 | 参考ページ | 特徴 |
|------|-----------|------|
| スクロール型プレゼン | `docs/kickoff.html` | セクション区切り、スクロールスナップ |
| スライド型プレゼン | `docs/dev-guide.html` | サイドバーナビ、横方向スライド |
| タイムライン | `docs/team.html` | ダークテーマ、スクロール連動 |
| ガイド・入門 | `docs/design-system-intro.html` | 読み物形式、ステップバイステップ |

**4. デザイン規約を指示に含める**

```
以下のデザイン規約に従ってください:
- 自己完結したHTML（外部CSS/JSなし）
- lang="ja"
- フォント: 見出し Zen Maru Gothic / 本文 Noto Sans JP / 英字 Montserrat
- カラーパレット: --coral:#FF6B6B --orange:#FFA552 --yellow:#FFD93D --mint:#6BCB77 --sky:#4D96FF --purple:#9B72CF
- index.html へ戻るナビゲーションを設置
```

> **Claude Code を使う場合:** このリポジトリ内で作業すれば `CLAUDE.md` を自動的に読み込むため、上記の規約を毎回指示する必要はありません。

### 生成後の仕上げ

ページが完成したら、以下を忘れずに行います。これもAIに依頼できます。

1. **documents.json にエントリを追加する**（[追加方法](#2-documentsjson-にエントリを追加する)も参照）
2. **`deno task build` で index.html を再生成する**
3. **スキル参照への追加を検討する**（[判断基準](#4-スキル参照への追加を検討する)を参照）

Claude Code で作業している場合は、以下のように一括で依頼できます:

```
作成したページを documents.json に追加し、index.html を再生成してください。スキル参照への追加が必要かも判断してください。
```

---

## リポジトリ構成

```
├── index.html                  # ドキュメントポータル（自動生成・直接編集しない）
├── documents.json              # ドキュメントメタデータ（グループ・カード情報）
├── deno.json                   # Deno タスク設定
├── scripts/
│   ├── build-index.ts          # index.html 生成スクリプト
│   ├── auto-register.ts        # 未登録HTML自動登録スクリプト
│   └── index.template.html     # index.html の HTML/CSS テンプレート
├── docs/                       # プレゼン・ガイド形式のHTMLドキュメント
├── work/                       # ワークシート・ワークショップ形式の資料
├── references/                 # 補足資料・リファレンス
├── .github/workflows/
│   └── deploy.yml              # GitHub Pages 自動デプロイ
├── skills/thanks-card-overview/ # AIエージェント向けスキル定義
│   ├── SKILL.md
│   └── references/
└── CLAUDE.md                   # Claude Code向けプロジェクト設定
```

## 技術スタック

- **Deno** — `deno task build` で `documents.json` + テンプレートから `index.html` を自動生成
- **GitHub Actions** — main push 時に未登録HTML自動登録＋自動ビルド＋GitHub Pages デプロイ
- 各HTMLページは **自己完結**（`<style>` `<script>` をインライン記述、共有CSS/JSなし）
- フォント: Google Fonts CDN — Zen Maru Gothic, Noto Sans JP, Montserrat, DM Sans
- 言語: すべて日本語 (`lang="ja"`)

## ドキュメントの追加

### 簡単な方法: GitHub Web UI からアップロード

HTMLファイルを `docs/`、`work/`、`references/` のいずれかに GitHub の Web UI からアップロードするだけで、CI が自動的に以下を行います:

1. `documents.json` に仮エントリを追加（`<title>` タグからタイトル、`<meta name="description">` から説明文を抽出）
2. `index.html` を再生成
3. GitHub Pages にデプロイ

メタデータ（アイコン・バッジ・グループ・色など）はデフォルト値で仮登録されるため、必要に応じて後から `documents.json` を手動編集してください。

### 1. HTMLファイルを作成する

適切なディレクトリに新しいHTMLファイルを作成します。

| ディレクトリ | 用途 |
|-------------|------|
| `docs/` | プレゼン・ガイド形式のドキュメント |
| `work/` | ワークシート・ワークショップ資料 |
| `references/` | 補足資料・リファレンス |

**基本ルール:**

- 各ページは自己完結させる（外部CSS/JSファイルへの依存なし）
- `lang="ja"` を設定する
- ページ内に `index.html` へ戻るナビゲーションを設置する

**デザイン共通設定（推奨）:**

```css
:root {
  --coral: #FF6B6B;
  --orange: #FFA552;
  --yellow: #FFD93D;
  --mint: #6BCB77;
  --sky: #4D96FF;
  --purple: #9B72CF;
}
```

- フォント: 見出し `Zen Maru Gothic`、本文 `Noto Sans JP`、英字ラベル `Montserrat`
- アニメーション easing: `cubic-bezier(0.22, 1, 0.36, 1)`

### 2. documents.json にエントリを追加する

`documents.json` の `documents` 配列に新しいエントリを追加します。`index.html` は直接編集しません。

```json
{
  "title": "ドキュメントタイトル",
  "path": "./docs/my-new-doc.html",
  "group": "dev",
  "icon": "📄",
  "badge": "BADGE",
  "color": "sky",
  "description": "ドキュメントの概要説明。",
  "meta": ["📄 補足情報"],
  "order": 1
}
```

- **`group`**: 既存グループの `id`（`project` / `dev` / `sprint0` など）から選ぶ
- **`color`**: `coral` / `sky` / `mint` / `purple` / `orange`
- **`comingSoon: true`**: 未公開カード（グレーアウト表示）

新しいグループが必要な場合は `groups` 配列にも追加します。

### 3. index.html を再生成する

```bash
deno task build
```

### 4. スキル参照への追加を検討する

`skills/thanks-card-overview/references/` にはプロジェクトの**安定的な情報**だけを置きます。AIエージェントがプロジェクトについて正確に回答できることが目的です。

**追加するもの:**
- チームで合意済みのプロジェクト定義
- コンピテンシー定義、チーム体制など長期間変わらない情報
- 開発プロセスやガイドなど、プロジェクト全体を通して参照されるもの

**追加しないもの:**
- 特定スプリントの活動資料（ワークシート、補足資料など一過性のもの）
- キックオフ資料など、作成時点のスナップショットで現在と乖離しうるもの

追加した場合は `skills/thanks-card-overview/SKILL.md` のドキュメント一覧テーブルも更新してください。

## ローカルでの確認

```bash
# index.html を生成（初回 or documents.json 変更時）
deno task build

# 簡易サーバーで確認
python3 -m http.server 8000
# または
npx serve .
```

`http://localhost:8000` にアクセスすると `index.html` が表示されます。

個別のHTMLページ（`docs/`, `work/` 内のファイル）はビルド不要でブラウザで直接開けます。

## ライセンス

MIT
