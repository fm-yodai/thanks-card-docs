---
name: add-doc
description: >-
  ドキュメントをプロジェクトに追加する。HTMLファイルパスやURLを引数として受け取り、
  documents.jsonへの登録、ファイル配置、index.htmlの再生成、スキル参照の更新を行う。
  「ドキュメントを追加」「ドキュメント登録」「add doc」「ドキュメント追加して」などと言われたときに使う。
user_invocable: true
arguments:
  - name: paths
    description: 追加するHTMLファイルのパスまたはURL（スペース区切りで複数指定可）
    required: false
---

# add-doc: ドキュメント追加スキル

このスキルは、ありがとうカードプロジェクトのドキュメントサイトに新しいドキュメントを追加する。
引数で受け取ったHTMLファイルやURLを `documents.json` に登録し、`index.html` を再生成する。

## 前提知識

### ディレクトリ構成と用途

| ディレクトリ | 用途 |
|-------------|------|
| `docs/` | プレゼン・ガイド形式のHTMLドキュメント |
| `work/` | ワークシート・ワークショップ形式の資料 |
| `references/` | 補足資料・リファレンス（Markdown / HTML） |

### documents.json のグループ分類

| グループ | theme | 方針 |
|----------|-------|------|
| **プロジェクト概要** (`project`) | `project` | プロジェクトの「今」を表すドキュメント（体制図、インセプションデッキなど） |
| **開発ガイド** (`dev`) | `dev` | 開発プロセス・手法に関するガイドやテンプレート |
| **Sprint N** (`sprintN`) | `reference` | 各スプリントで作成・使用した資料。Sprint単位でグループを作る |

新しいグループが必要な場合は、`documents.json` の `groups` 配列にも追加する。

### ドキュメントエントリのフィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | Yes | カード表示タイトル（日本語） |
| `path` | Yes | HTMLファイルへの相対パス（`./docs/xxx.html`）またはURL |
| `group` | Yes | 所属グループID |
| `icon` | Yes | 絵文字アイコン（1文字） |
| `badge` | Yes | 英字バッジラベル（GUIDE, WORK, INFO 等） |
| `color` | Yes | `coral` / `sky` / `mint` / `purple` / `orange` のいずれか |
| `description` | Yes | カードの説明文（日本語、1-2文） |
| `meta` | No | メタ情報の配列（例: `["📄 全7セクション", "⏱ 約5分"]`） |
| `order` | Yes | グループ内の表示順（整数） |
| `comingSoon` | No | `true` にするとグレーアウト表示 |

### 既存のバッジ例

TEAM, DECK, GUIDE, SETUP, INTRO, DESIGN, TEMPLATE, KICKOFF, INFO, WORK

## 処理フロー

### ステップ 0: 引数の解析

引数を解析し、各項目を以下に分類する:
- **HTMLファイル**: ファイルパスとして存在するもの（リポジトリ内外を問わない）
- **URL**: `http://` または `https://` で始まるもの
- **引数なし**: AskUserQuestion で追加対象を質問する

### ステップ 1: 各項目の処理

#### HTMLファイルの場合

1. **ファイルを読む**: Read ツールでHTMLの内容を確認する
2. **配置先を決める**:
   - ファイルが既にリポジトリ内の `docs/` `work/` `references/` にある → そのまま使う
   - それ以外の場所にある → 内容に基づいて適切なディレクトリを判断し、ケバブケースのファイル名でコピーする
3. **メタデータを自動推定する**: HTMLの `<title>`, `<h1>`, 本文内容から以下を推定する:
   - `title`: ページタイトル
   - `description`: 1-2文の説明
   - `group`: 内容に最も合うグループ
   - `icon`: 内容を表す絵文字
   - `badge`: 英字バッジ
   - `color`: テーマカラー
   - `meta`: ページ数や所要時間など（推定可能な場合）
   - `order`: グループ内の末尾（既存の最大値 + 1）
4. **ユーザーに確認する**: AskUserQuestion で推定結果を提示し確認を取る。以下のような形式で1つの質問にまとめる:

```
以下の内容で documents.json に登録します。修正が必要な場合は「Other」で指定してください。

- タイトル: {title}
- 配置先: {path}
- グループ: {group}
- アイコン: {icon}
- バッジ: {badge}
- カラー: {color}
- 説明: {description}
- メタ: {meta}
```

選択肢: 「この内容でOK (Recommended)」「修正して登録」

5. ユーザーが修正を求めた場合、指定された内容で調整する

#### URLの場合

1. **必要情報を質問する**: AskUserQuestion で以下を質問する:
   - `title`: カードに表示するタイトル
   - `group`: 所属グループ
   - `description`: 説明文
   - `icon`: アイコン絵文字
   - `badge`: バッジラベル
   - `color`: テーマカラー

   URL先の内容が推測できる場合（URLのパスやドメインから）、推定値を選択肢の先頭に提示する。

### ステップ 2: documents.json の更新

1. `documents.json` を Read で読み込む
2. `documents` 配列に新しいエントリを追加する
3. 新しいグループが必要な場合は `groups` 配列にも追加する
4. Edit ツールで `documents.json` を更新する（JSON のフォーマットを維持する）

### ステップ 3: index.html の再生成

```bash
cd /home/yodai/thanks-card-docs && deno task build
```

ビルド結果を確認し、エラーがあれば修正する。

### ステップ 4: スキル参照の更新判断

追加したドキュメントが以下の基準に該当するか判断する:

**スキル参照に含めるべきもの:**
- チームで合意済みのプロジェクト定義（インセプションデッキなど）
- コンピテンシー定義、チーム体制など長期間変わらない情報
- 開発プロセスやガイドなど、プロジェクト全体を通して参照されるもの

**含めないもの:**
- 特定スプリントの活動資料（ワークシート、補足資料など一過性のもの）
- キックオフ資料など、作成時点のスナップショットで現在と乖離しうるもの
- 一般的な手法解説（インセプションデッキの作り方、デザインスプリントの進め方など）

該当すると判断した場合:
1. AskUserQuestion で「スキル参照（skills/thanks-card-overview/references/）にも追加しますか？」と確認する
2. ユーザーが承認した場合:
   a. HTMLからMarkdownに変換した参照ファイルを `skills/thanks-card-overview/references/` に作成する
   b. `skills/thanks-card-overview/SKILL.md` のドキュメント一覧テーブルに行を追加する

### ステップ 5: 完了報告

追加したドキュメントの一覧を表示する。複数ファイルの場合はまとめて報告する。

```
ドキュメントを追加しました:
- {title} → {path} (グループ: {group})
- ...

実行した処理:
- [x] ファイル配置
- [x] documents.json 更新
- [x] index.html 再生成
- [ ] スキル参照追加（該当なし）
```
