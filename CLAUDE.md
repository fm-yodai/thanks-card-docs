# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static HTML documentation site for the "ありがとうカード" (Thank You Card) project — an internal web app being built by FREEMIND Inc. to enable employees to send thank-you messages with AI-powered competency labeling. This repository contains **only the project documentation**, not the application itself.

## Repository Structure

- `index.html` — **自動生成** ドキュメントポータル（`deno task build` で生成、直接編集しない）
- `documents.json` — ドキュメントのメタデータ定義（グループ・カード情報の単一ソース）
- `scripts/` — ビルドスクリプト:
  - `build-index.ts` — `documents.json` + テンプレートから `index.html` を生成する Deno スクリプト
  - `auto-register.ts` — 未登録 HTML を検出し `documents.json` に自動追加するスクリプト
  - `index.template.html` — `index.html` の HTML/CSS テンプレート（`{{SECTIONS}}` / `{{ANIMATION_DELAYS}}` プレースホルダ）
- `deno.json` — Deno タスク設定
- `docs/` — プレゼン・ガイド形式のHTMLドキュメント
- `work/` — ワークシート・ワークショップ形式の資料
- `references/` — 補足資料・リファレンス（Markdown / HTML）
- `.github/workflows/deploy.yml` — GitHub Pages 自動デプロイ（push to main → build → deploy）
- `.claude-plugin/` — Plugin manifest (Agent Skills standard)
- `skills/thanks-card-overview/` — AI agent skill (Agent Skills open standard, 40+ tools compatible):
  - `SKILL.md` — スキル定義（ドキュメントカタログ + 制約サマリ）
  - `references/` — プロジェクトドキュメント一式（Markdown）

## Technical Details

- **Build system:** Deno — `deno task build` で `index.html` を自動生成（`documents.json` + `scripts/index.template.html` → `index.html`）
- **CI/CD:** GitHub Actions — main push 時に自動登録＋自動ビルド＋GitHub Pages デプロイ
- **Auto-register:** `deno task auto-register` — `docs/`, `work/`, `references/` 直下の未登録 HTML を検出し `documents.json` に仮登録する。CI で自動実行され、変更があればコミットバックされる
- **No tests or linting** — Static documentation only
- `index.html` は `.gitignore` に含まれる（生成物のため直接コミットしない）
- Each HTML page is fully self-contained (inline `<style>` and `<script>` blocks, no shared CSS/JS files)
- All content is in **Japanese (lang="ja")**
- Google Fonts are loaded via CDN: Zen Maru Gothic, Noto Sans JP, Montserrat, DM Sans

## Design Conventions

- Color palette uses CSS custom properties defined in each page's `:root` (coral, orange, yellow, mint, sky, purple variants)
- `index.html` and `kickoff.html` use a warm cream (`#FFF8F0`) background; `team.html` uses a dark slate (`#0f172a`) background
- `dev-guide.html` uses a minimal warm gray (`#F7F6F2`) design with abbreviated CSS class names (`.sl`, `.sc`, `.cd`, `.co`, etc.)
- Responsive breakpoints at 640px–800px depending on the page
- Animations use `cubic-bezier(0.22, 1, 0.36, 1)` easing consistently

## Document Management (documents.json)

ドキュメントの追加・変更は `documents.json` を編集し、`deno task build` で `index.html` を再生成する。`index.html` を直接編集しない。

### ドキュメントの追加手順

1. HTMLファイルを適切なディレクトリに作成する（`docs/`, `work/`, `references/`）
2. `documents.json` の `documents` 配列にエントリを追加する（GitHub Web UI からアップロードした場合は CI が自動で仮登録する）
3. `deno task build` を実行して `index.html` を再生成する

> **自動登録:** GitHub Web UI で HTML をアップロードするだけで、CI が `documents.json` への仮登録・`index.html` 再生成・デプロイまで自動で行います。メタデータ（タイトル・説明文・グループなど）は後から `documents.json` を手動編集して調整できます。

### documents.json のスキーマ

**グループ（`groups`）:**
- `id` — グループID（ドキュメントの `group` フィールドと対応）
- `theme` — CSSテーマ（`project` / `dev` / `reference`）。新テーマの場合は `scripts/index.template.html` にCSSも追加する
- `label` — セクションラベル（英語大文字: `PROJECT`, `SPRINT 1` など）
- `title` — セクションタイトル（日本語）
- `description` — セクションの説明文
- `order` — 表示順

**ドキュメント（`documents`）:**
- `title`, `path`, `group`, `icon`, `badges` (配列), `color`, `description`, `meta`, `order`
- `comingSoon: true` — 未公開カード（グレーアウト表示）
- `color` の選択肢: `coral` / `sky` / `mint` / `purple` / `orange`

### グループの分類方針

| グループ | theme | 方針 |
|----------|-------|------|
| **プロジェクト概要** (PROJECT) | `project` | プロジェクトの「今」を表すドキュメント（体制図、インセプションデッキなど） |
| **開発ガイド** (DEVELOPMENT) | `dev` | 開発プロセス・手法に関するガイドやテンプレート |
| **Sprint N** | `reference` | 各スプリントフェーズで作成・使用した資料。Sprint単位でグループを作る |

## Skill References (skills/thanks-card-overview/)

スキルの `references/` にはプロジェクトの**現在の状態**を表す安定的なドキュメントだけを置く。AIエージェントがプロジェクトについて正確に回答できることが目的。

### 含めるもの
- チームで合意済みのプロジェクト定義（インセプションデッキなど）
- コンピテンシー定義、チーム体制など、長期間変わらない情報
- 開発プロセスやガイドなど、プロジェクト全体を通して参照されるもの

### 含めないもの
- 特定スプリントの活動資料（ワークシート、補足資料など一過性のもの）
- キックオフ資料など、作成時点のスナップショットで現在と乖離しうるもの
- 一般的な手法解説（インセプションデッキの作り方、デザインスプリントの進め方など）

### 更新タイミング
- `documents.json` に新しいドキュメントを追加したとき → 上記の基準に照らしてスキル参照への追加を検討する
- プロジェクトの方針・体制に変更があったとき → 既存の参照ドキュメントを更新する
- `SKILL.md` のドキュメント一覧テーブルも参照ファイルの追加・削除に合わせて更新する

## Key Project Context (from requirements.md)

- Target: 60 employees across 4 departments (営業部, 開発部, DX企画部, 管理部)
- 5 core competencies for AI labeling: 誠実, 当事者意識, 協働, 挑戦への意欲, 創造的思考
- Development approach: Agile/Scrum with 2-week sprints, ~6 month timeline to MVP
- Infrastructure budget: 50 USD/month
