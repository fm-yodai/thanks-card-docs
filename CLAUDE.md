# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static HTML documentation site for the "ありがとうカード" (Thank You Card) project — an internal web app being built by FREEMIND Inc. to enable employees to send thank-you messages with AI-powered competency labeling. This repository contains **only the project documentation**, not the application itself.

## Repository Structure

- `index.html` — Landing page / document portal linking to all docs
- `docs/` — Presentation-style HTML documents:
  - `kickoff.html` — Full-page scroll-snap presentation (7 sections with IntersectionObserver navigation)
  - `dev-guide.html` — Slide-based presentation (horizontal slide transitions with sidebar navigation, 12 main slides + 5 appendices)
  - `team.html` — Timeline-style project team structure page (dark theme with scroll-driven background color changes)
- `references/` — Reference materials in Markdown:
  - `requirements.md` — Project charter / requirements document (MVP scope, feature list, constraints)
  - `lighthouse.md` — Company philosophy (Lighthouse principles)
  - `ideal-candidate-profile.md` — Core competency definitions with Do/Don't examples
- `.claude-plugin/` — Plugin manifest (Agent Skills standard)
- `skills/thanks-card-overview/` — AI agent skill (Agent Skills open standard, 40+ tools compatible):
  - `SKILL.md` — スキル定義（ドキュメントカタログ + 制約サマリ）
  - `references/` — プロジェクトドキュメント一式（Markdown）

## Technical Details

- **No build system** — All files are plain HTML/CSS/JS with no bundler, no package.json, no dependencies to install
- **No tests or linting** — Static documentation only
- Each HTML page is fully self-contained (inline `<style>` and `<script>` blocks, no shared CSS/JS files)
- All content is in **Japanese (lang="ja")**
- Google Fonts are loaded via CDN: Zen Maru Gothic, Noto Sans JP, Montserrat, DM Sans

## Design Conventions

- Color palette uses CSS custom properties defined in each page's `:root` (coral, orange, yellow, mint, sky, purple variants)
- `index.html` and `kickoff.html` use a warm cream (`#FFF8F0`) background; `team.html` uses a dark slate (`#0f172a`) background
- `dev-guide.html` uses a minimal warm gray (`#F7F6F2`) design with abbreviated CSS class names (`.sl`, `.sc`, `.cd`, `.co`, etc.)
- Responsive breakpoints at 640px–800px depending on the page
- Animations use `cubic-bezier(0.22, 1, 0.36, 1)` easing consistently

## Document Grouping (index.html)

`index.html` のドキュメントカードはグループ（セクション）単位で分類する。新しいドキュメントを追加する際は、既存グループに合うものがあればそこに入れ、なければ新しいグループを作成する。

現在のグループと分類方針:

| グループ | data-theme | 方針 |
|----------|------------|------|
| **プロジェクト概要** (PROJECT) | `project` | プロジェクトの「今」を表すドキュメント（体制図、インセプションデッキなど） |
| **開発ガイド** (DEVELOPMENT) | `dev` | 開発プロセス・手法に関するガイドやテンプレート |
| **Sprint N** | `reference` | 各スプリントフェーズで作成・使用した資料。Sprint単位でグループを作る |

新しいグループを作る場合:
- `data-theme` は既存の `project` / `dev` / `reference` から選ぶか、必要に応じて新しいテーマを追加する（その場合 `.section[data-theme="..."] .section-label` のCSSも追加する）
- セクションラベルは英語大文字（`SPRINT 1` など）、セクションタイトルは日本語
- アニメーション遅延は `.section:nth-child(N)` で設定されている（現在3つ分）。グループが増えたら追加する

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
- `index.html` に新しいドキュメントを追加したとき → 上記の基準に照らしてスキル参照への追加を検討する
- プロジェクトの方針・体制に変更があったとき → 既存の参照ドキュメントを更新する
- `SKILL.md` のドキュメント一覧テーブルも参照ファイルの追加・削除に合わせて更新する

## Key Project Context (from requirements.md)

- Target: 60 employees across 4 departments (営業部, 開発部, DX企画部, 管理部)
- 5 core competencies for AI labeling: 誠実, 当事者意識, 協働, 挑戦への意欲, 創造的思考
- Development approach: Agile/Scrum with 2-week sprints, ~6 month timeline to MVP
- Infrastructure budget: 50 USD/month
