# 01 デザイントークン

デザインの最小単位。色・余白・フォント・角丸・影・モーションなどの値を CSS 変数として一元定義する。すべてのコンポーネントはこのトークンのみを参照する。

## エージェント向け指示

- すべての視覚的な値には `var(--ds-*)` を使え。ハードコード値は禁止。
- 定義にない値が必要になった場合は、新しいトークンの追加を提案せよ。勝手にハードコードしてはならない。

## 命名規則

```
--ds-{カテゴリ}-{名前}
```

例: `--ds-color-primary-500`, `--ds-space-4`, `--ds-font-size-base`

---

## Color

[00-concept.md](./00-concept.md) の「種まき」コンセプトに基づき、温かみのあるトーンを基調とする。

### 構造

色トークンは Primitive（実値）と Semantic（用途名）の 2 層で管理する。コンポーネントでは Semantic カラーを使用する。

```
Primitive（実値）           Semantic（用途名）
──────────────────        ──────────────────
--ds-color-primary-500  ←  --ds-color-interactive-default
--ds-color-neutral-900  ←  --ds-color-text-primary
--ds-color-neutral-50   ←  --ds-color-surface-base
```

この分離により、将来のダークモード対応は Semantic 層の参照先を切り替えるだけで済む。

### Primitive カラー

| グループ | スケール | 用途 |
|---|---|---|
| `primary` | 50 〜 900（10 段階） | メインカラー |
| `neutral` | 50 〜 900（10 段階） | グレースケール |

### Semantic カラー

| カテゴリ | トークン例 | 用途 |
|---|---|---|
| テキスト | `text-primary`, `text-secondary`, `text-tertiary`, `text-inverse` | 文字色 |
| サーフェス | `surface-base`, `surface-card`, `surface-overlay` | 背景色 |
| ボーダー | `border-default`, `border-strong` | 境界線 |
| インタラクティブ | `interactive-default`, `interactive-hover`, `interactive-active`, `interactive-disabled` | ボタン・リンク等 |
| ステータス | `success`, `warning`, `error`, `info` | フィードバック |

### コンピテンシーカラー

5 つのコアコンピテンシーにそれぞれ固有の色を割り当てる。通常版と背景用の薄い版（`-subtle`）を用意する。

| ID | 名称 | トークン |
|---|---|---|
| `sincerity` | 誠実 | `--ds-color-competency-sincerity` |
| `ownership` | 当事者意識 | `--ds-color-competency-ownership` |
| `collaboration` | 協働 | `--ds-color-competency-collaboration` |
| `challenge` | 挑戦への意欲 | `--ds-color-competency-challenge` |
| `creativity` | 創造的思考 | `--ds-color-competency-creativity` |

各コンピテンシーにはピクトグラム画像を用意している（`design/brand-kit.pen` および画像アセットとして管理）。Emoji は使用しない。

---

## Spacing

4px 刻みの 8 段階。余白・パディング・ギャップにはこのスケールのみを使用する。

| トークン | 値 | 用途の目安 |
|---|---|---|
| `space-1` | 4px | アイコンとテキストの間など最小の間隔 |
| `space-2` | 8px | コンパクトな要素内のパディング |
| `space-3` | 12px | 関連する要素間の余白 |
| `space-4` | 16px | カード内パディング、標準的な余白 |
| `space-5` | 24px | セクション内の要素間 |
| `space-6` | 32px | セクション間の余白 |
| `space-7` | 48px | ページレベルの大きな余白 |
| `space-8` | 64px | ヒーローセクション等の特大余白 |

---

## Typography

| カテゴリ | トークン | 備考 |
|---|---|---|
| ファミリー | `font-family-display`, `font-family-body`, `font-family-mono` | 日本語対応フォントを選定する |
| サイズ | `font-size-xs`(12) 〜 `font-size-3xl`(30) の 7 段階 | |
| ウェイト | `font-weight-regular`(400), `medium`(500), `semibold`(600), `bold`(700) | |
| 行間 | `line-height-tight`(1.25), `normal`(1.5), `relaxed`(1.75) | 日本語本文には `relaxed` を推奨 |

---

## Shape

| カテゴリ | トークン | 備考 |
|---|---|---|
| 角丸 | `radius-none`(0), `sm`(4), `md`(8), `lg`(12), `xl`(16), `full`(9999) | Avatar 等の円形要素には `full` |
| 影 | `shadow-sm`, `shadow-md`, `shadow-lg` | |
| 罫線幅 | `border-thin`(1px), `border-medium`(2px) | |

---

## Motion

アニメーションは控えめに。「種が芽吹く」ような静かな動きを基調とする（[00-concept.md](./00-concept.md)）。

| カテゴリ | トークン | 用途の目安 |
|---|---|---|
| 持続時間 | `duration-fast`(150ms), `duration-normal`(250ms), `duration-slow`(400ms) | |
| イージング | `easing-default`(ease-out), `easing-in-out`, `easing-spring` | カード送信演出等には `spring` |

---

## レスポンシブ設計

### 基本方針

メディアクエリではなく **CSS Grid + コンテナクエリ** で対応する。

- `display: grid` と `auto-fill` / `auto-fit` を活用し、明示的なブレイクポイント分岐なしでコンテンツを流し込む設計を基本とする。
- Grid だけでは対応できないレイアウト変化（例: サイドバーの表示切替）に限り、コンテナクエリを使用する。コンテナクエリの使用は最小限に抑える。
- メディアクエリは使用しない。

### 設計の優先順位

```
1. CSS Grid（auto-fill / minmax 等）で暗黙的にレスポンシブにする ← 最優先
2. Grid だけでは不足する場合にコンテナクエリで補う ← 限定的に使用
3. メディアクエリ ← 使用しない
```

### コンテナクエリのサイズ目安

コンテナクエリを使う場合の参考値。ビューポートではなくコンテナ幅に対する閾値。

| 目安 | 用途 |
|---|---|
| < 400px | コンパクト表示（カードの縦積み等） |
| 400px 〜 640px | 標準表示 |
| > 640px | 拡張表示（横並びレイアウト等） |

これらは目安であり、コンテナの文脈に応じて適切な値を判断すること。
