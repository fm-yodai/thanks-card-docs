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
- `skills/project/` — AI agent skill (Agent Skills open standard, 40+ tools compatible):
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

## Key Project Context (from requirements.md)

- Target: 60 employees across 4 departments (営業部, 開発部, DX企画部, 管理部)
- 5 core competencies for AI labeling: 誠実, 当事者意識, 協働, 挑戦への意欲, 創造的思考
- Development approach: Agile/Scrum with 2-week sprints, ~6 month timeline to MVP
- Infrastructure budget: 50 USD/month
