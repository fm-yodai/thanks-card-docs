# 技術選定 & アーキテクチャ設計ノート

Sprint 0 で策定した技術選定の「なぜ」と実装レベルの「どうするか」をまとめたドキュメント。

- リポジトリ: thanks-card/
- 対象: 全社員 60名
- 予算: 月 50 USD
- スタック: Vue 3 / Hono / DynamoDB / SST v3

---

## 判断の大方針

技術選定・設計判断のすべてはこの3原則から導出される。

1. **学びの方向性** — ジュニアメンバーが「普段シニアに任せてしまう領域」を経験できるか。言語・FWの学習コストは抑え、インフラやアーキテクチャの学びにリソースを振る。
2. **月 50 USD の予算制約** — インフラ＋AI APIコストをこの枠内に収める。フルマネージド・サーバーレス・無料枠の活用を優先し、運用負荷も最小化する。
3. **外販への備え** — マルチテナント設計・REST互換APIなど、MVP段階から外販フェーズへの移行コストを最小に抑える構造を選択する。

---

## 技術スタック一覧

| カテゴリ | 選定 | ステータス | 選定理由 |
|----------|------|-----------|---------|
| 言語 | TypeScript（フルスタック） | 暫定 | 学習コスト低・型共有・AIエージェント親和 |
| フロント FW | Vue 3 + S3 / CloudFront | 暫定 | 社内標準・静的配信でサーバー不要・SSTでAWS統一管理 |
| UI ライブラリ | shadcn-vue + 独自コンポーネント | 暫定 | ヘッドレスで自由度高・Tailwind CSS 前提 |
| CSS | Tailwind CSS | 暫定 | shadcn-vue 前提・AIエージェント親和・一貫性 |
| ルーティング | createRouter（手書き） | 暫定 | 透明性が高くジュニアに分かりやすい。ナビゲーションガードの挙動が明示的 |
| 状態管理 | TanStack Query + composable（Pinia不使用） | 暫定 | サーバー状態は TanStack Query、UIローカル状態は composable の ref で管理 |
| バックエンド | Hono on AWS Lambda | 暫定 | TSファースト・Web標準APIベース・サーバーレスで運用負荷小 |
| API スタイル | Hono RPC（hono/client） | 暫定 | REST 互換で外販可・型安全・追加ライブラリ不要 |
| データベース | DynamoDB | 確定 | 月 $1 以下・フルマネージド・サーバーレス親和。テーブル設計方式はプロト検証後に決定 |
| DB クライアント | ElectroDB | チーム確認 | Single Table Design 支援・型推論・SST 推奨。テーブル設計方式はプロト検証後に決定 |
| 認証 | Cognito + Google OAuth + oidc-client-ts | 確定 | AWS統一・IAM一元管理・5万ユーザー無料。フロントSDKは oidc-client-ts（外販時のIdP切り替え対応） |
| AI API | Amazon Bedrock（モデル使い分け） | 暫定 | AWS統一・IAM認証・用途別最適化 |
| Linter | Oxlint + ESLint（eslint-plugin-vue） | 暫定 | 高速Rust製 + Vue テンプレート対応の両立 |
| Formatter | Prettier（将来 Oxfmt 移行検討） | 暫定 | Vue SFC 対応が安定・段階的移行可能 |
| テスト | Vitest + Playwright（MVPから導入） | 暫定 | Vitest でユニット、Playwright で E2E。MVPから両方導入 |
| CI/CD | GitHub Actions + SST | 暫定 | GitHub内で完結・ジュニアのCI/CD実践学習になる |
| モノレポ | pnpm workspace（→ Turborepo 検討） | 暫定 | シンプルスタート・CIが遅くなったら段階的に強化 |
| Git 規約 | Conventional Commits + ブランチ命名 | 暫定 | プレフィクス推奨（強制なし）。commitlint は外販確定時に導入検討 |
| 環境分離 | SST ステージ（→ アカウント分離検討） | 暫定 | 素早く立ち上げ・外販時に移行 |

> **Bedrock MVPスコープ:** カード文面提案（Sonnet級ストリーミング）はMVP後に検討。MVPでは コンテンツフィルタ + コンピテンシー自動判定 のみ実装する。

---

## モノレポ構成

pnpm workspaces による構成。型・DBエンティティ・共通設定をパッケージとして分離し、フロント・バック間で一元管理する。

```
thanks-card/                          ← リポジトリルート
├── apps/
│   ├── web/                          ← Vue 3 + Vite（shadcn-vue / Tailwind CSS）
│   │   └── src/
│   │       ├── pages/                ← ルート対応ページコンポーネント
│   │       ├── features/             ← 機能単位のコンポーネント群
│   │       ├── components/           ← 汎用UIコンポーネント（shadcn-vue + 独自）
│   │       ├── composables/          ← Vue Composables（useAuth等）
│   │       ├── composables/          ← Vue Composables（useAuth, useCurrentUser 等）
│   │       ├── queries/              ← TanStack Query定義（サーバー状態）
│   │       ├── router/               ← Vue Router設定・ナビゲーションガード
│   │       ├── api/                  ← Hono RPCクライアント生成・fetchラッパー
│   │       └── layouts/              ← AppLayout / AuthLayout
│   │
│   ├── api/                          ← Hono バックエンド（Lambda）
│   │   └── src/
│   │       ├── routes/               ← ルート定義（cards / users / admin）
│   │       ├── middleware/            ← auth / logging / error ミドルウェア
│   │       ├── handlers/             ← DynamoDB Streams / EventBridge Lambda ハンドラー
│   │       ├── services/             ← Bedrock / SES アクセス層
│   │       └── lib/                  ← DynamoDBクライアント等のシングルトン
│
├── packages/
│   ├── shared/                       ← Zodスキーマ・共通型定義・定数（最重要）
│   │   └── src/
│   │       ├── schemas/              ← card / user / competency のZodスキーマ
│   │       └── index.ts              ← 全スキーマ・型のエクスポート
│   │
│   ├── db/                           ← ElectroDBエンティティ定義・DBヘルパー
│   │   └── src/
│   │       ├── entities/             ← Card / User / Reaction エンティティ
│   │       └── index.ts
│   │
│   └── config/                       ← tsconfig / ESLint / Oxlint / Prettier 共通設定
│
├── infra/                            ← SST v3 (Ion) IaC
│   └── sst.config.ts
│
├── etl/                              ← Python ETL（pnpm管理外・独立）
├── pnpm-workspace.yaml
└── package.json                      ← ルートスクリプト（lint / typecheck / test）
```

- **packages/shared** — Zodスキーマ・共通型定義・定数。フロントとバック両方で使うものだけを入れる
- **packages/db** — ElectroDBエンティティ定義・DBヘルパー。apps/api から参照
- **packages/config** — tsconfig・ESLint / Oxlint / Prettier 共通設定。全パッケージから extends で参照

> **型共有の仕組み:** packages/shared に Zod スキーマを定義し、`z.infer<>` で TypeScript 型を自動導出。apps/api はスキーマでリクエスト検証・レスポンス型定義、apps/web は Hono RPC クライアントの型推論を通じて同じ型を参照する。スキーマを1箇所変更するだけでバックエンド・フロントエンド両方で型エラーが検出される。

---

## フロントエンド設計

Vue 3 + shadcn-vue + Tailwind CSS + createRouter。

### UI ライブラリ構成

- **shadcn-vue** — Radix Vue ベースのヘッドレスUI。Button / Input / Dialog 等の基本UIは shadcn-vue で統一し、カード表示など独自性の高いUIは自前コンポーネントで構築
- **Tailwind CSS** — shadcn-vue の前提構成。ユーティリティファーストでスタイルの一貫性を保ちやすい

### ルーティング設計

| パス | ガード | ページ | 概要 |
|------|--------|--------|------|
| /login | PUBLIC | LoginPage | Googleログインボタンのみ。ログイン済みなら /timeline にリダイレクト |
| /timeline | AUTH | TimelinePage | 全社公開カードの時系列一覧。無限スクロール |
| /cards/new | AUTH | CardNewPage | カード送信フォーム。宛先選択・メッセージ入力・公開設定 |
| /my | AUTH | MyPage | 受信一覧・送信一覧・コンピテンシーレーダーチャート・バッジ・ストリーク |

> **ユーザー管理方針:** 管理者向けのユーザー管理Web UIは作らない。Cognito Post-Confirmation トリガーで初回 Google OAuth ログイン時に DynamoDB UserProfile を自動作成する。MVPでは Google OAuth で取得できる情報（名前・メール・アイコン）のみで運用し、部署情報は保持しない。

### 状態管理方針（TanStack Query + composable）

設計原則: サーバー状態は TanStack Query、UIローカル状態は composable の `ref` で管理する。Pinia は使用しない。60名規模のアプリに Pinia を入れるメリットよりも、composable だけで完結するシンプルさを優先する。

- **useAuth（composable）** — Cognitoセッション・JWTトークン・ユーザー情報・isAdminフラグ
- **UI状態（composable の ref）** — モーダルの開閉・フォーム入力中の一時データ・サイドバー展開状態
- **サーバー状態（TanStack Query）** — カード一覧・ユーザー情報・レーダーチャートデータなど、APIから取得するすべてのデータ

### カードステータス表示 — ポーリング設計

Lambda + API Gateway の制約によりSSEは現実的でない（API Gateway HTTP API の接続時間上限は 29 秒）。

**採用:** TanStack Query の `refetchInterval` によるステータス条件付きポーリング。カードの `status === 'processing'` の間だけ 5 秒間隔でポーリング。`status` が `published` または `blocked` に変わった時点でポーリングが自動停止する。

```typescript
// queries/useCardQuery.ts
export function useCardQuery(cardId: string) {
  return useQuery({
    queryKey: ['cards', cardId],
    queryFn: () => api.cards[':id'].$get({ param: { id: cardId } }),
    // status が 'processing' の間だけ 5 秒ポーリング
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 5000 : false,
  })
}
```

---

## バックエンド設計

### Lambda 関数の粒度

- **モノリシック Hono Lambda（HTTPリクエスト用）** — 全HTTPルートを1つのHonoアプリ・1つのLambda関数に集約。Hono RPCの型推論がシンプルに機能
- **専用 Lambda（非同期ワーカー用）** — SQSコンシューマ・EventBridgeトリガー・ETLは別Lambdaとして分離

| Lambda 関数 | トリガー | タイムアウト | 役割 |
|------------|---------|-----------|------|
| api | API Gateway HTTP API | 30s | 全HTTPルート（Hono） |
| aiWorker | DynamoDB Streams | 5 min | Streams受信 → Bedrockフィルタ + コンピテンシー判定 |
| notifier | EventBridge（毎朝9:00 / 月初） | 5 min | 日次まとめメール・月次サマリー（SES） |
| etl | EventBridge（月初 / オンデマンド） | 15 min | Python Lambda。DynamoDB Export to S3 → marimo + polars + plotly で分析 |

### Hono API ルート構成

| エンドポイント | メソッド | ガード | 概要 |
|--------------|---------|--------|------|
| /cards | GET | AUTH | タイムライン取得（cursor-based pagination） |
| /cards | POST | AUTH | カード送信（DynamoDB書込 + Streams自動トリガー） |
| /cards/:id | GET | AUTH | カード単体取得（ポーリング用） |
| /users/me | GET | AUTH | 自分のプロフィール・バッジ・ストリーク取得 |
| /users/me/cards/received | GET | AUTH | 受信カード一覧（マイページ） |
| /users/me/cards/sent | GET | AUTH | 送信カード一覧（マイページ） |
| /users/me/radar | GET | AUTH | レーダーチャートデータ取得（?month=2026-03） |
| /users | GET | AUTH | ユーザー一覧（宛先選択用） |

### ミドルウェアスタック（リクエスト通過順）

1. **errorHandler()** — 未捕捉エラーを { error, message, requestId } 形式で JSON 化（最外層）
2. **cors()** — 許可オリジンを環境変数で切り替え
3. **requestId()** — X-Request-ID ヘッダーを付与
4. **logger()** — JSON 構造化ログ { timestamp, event, userId, requestId, latencyMs }
5. **jwtAuth()** — Cognito の JWKS を使い JWT を検証。失敗 → 401
6. **zValidator()** — packages/shared の Zod スキーマでリクエストを検証。失敗 → 422
7. **route handler** — ビジネスロジック

> **認証フロー:** Cognito Hosted UI + Authorization Code Flow with PKCE。JWT検証は Hono ミドルウェアで JWKS を使い公開鍵検証（jose ライブラリ）。

### カード送信フロー

**同期処理（POST /cards）:**
Vue フロント → Hono Lambda → Zod 検証 → DynamoDB 書込（status: 'processing'） → 201 Created

**非同期処理（DynamoDB Streams → aiWorker Lambda）:**
- Streams 受信（INSERT イベント）→ aiWorker Lambda
- Bedrock フィルタ判定:
  - OK → DynamoDB 更新（status: 'published'）→ Bedrock コンピテンシー判定 → DynamoDB 更新（competencies + RadarAgg）
  - NG → DynamoDB 更新（status: 'blocked'）→ SES 即時メール（管理者通知）

> **DynamoDB Streams 採用理由:** DB書込が成功すれば自動的に Lambda がトリガーされ、SQS投入失敗によるトランザクション整合性の問題を構造的に排除できる。

> **障害対策:** DLQ（デッドレターキュー）を設定し、3回リトライ後に失敗レコードを退避。CloudWatch Alarms でLambdaエラー率・DLQメッセージ数を監視。

---

## DynamoDB シングルテーブル設計

全データを1テーブルに集約。PK/SKのプレフィクスでエンティティタイプを表現。DBクライアントは ElectroDB を使用。

### テーブル定義

| アイテムタイプ | PK | SK | GSI1-PK | GSI1-SK | 用途 |
|--------------|-----|-----|---------|---------|------|
| **ユーザー系** | | | | | |
| UserProfile | USER#\<userId\> | PROFILE | — | — | 名前・メール・ロール・通知設定 |
| UserStreak | USER#\<userId\> | STREAK | — | — | currentStreak / longestStreak / lastSentDate |
| UserBadge | USER#\<userId\> | BADGE#\<competency\> | — | — | コンピテンシー別バッジレベル |
| RadarAgg | USER#\<userId\> | RADAR#\<YYYY-MM\> | — | — | 月別×コンピテンシー別集計 Map |
| **カード系** | | | | | |
| CardMetadata | CARD#\<cardId\> | METADATA | TIMELINE#\<YYYY-MM\> | \<createdAt\>#\<cardId\> | カード本体。status / competencies / isPublic 等 |
| CardSent | USER#\<userId\> | SENT#\<createdAt\>#\<cardId\> | — | — | 送信一覧（降順クエリ用） |
| CardReceived | USER#\<recipientId\> | RECV#\<createdAt\>#\<cardId\> | — | — | 受信一覧（降順クエリ用） |
| **リアクション系（MVP後）** | | | | | |
| Reaction | CARD#\<cardId\> | REACTION#\<userId\> | — | — | 1ユーザー1リアクション |

> **マルチテナント対応:** 外販フェーズに備え、すべての PK に `TENANT#<tenantId>|` プレフィクスを付与するオプションを想定。MVP段階では省略し、外販フェーズで移行スクリプトで対応する。

### 主要アクセスパターン

| パターン | クエリ方法 |
|---------|----------|
| タイムライン取得 | GSI1 Query: PK=`TIMELINE#<YYYY-MM>`, ScanIndexForward=false, Limit=20, Filter: isPublic=true AND status='published' |
| 受信カード一覧 | Main Table Query: PK=`USER#<userId>`, SK begins_with `RECV#`, ScanIndexForward=false |
| レーダーチャート集計 | Main Table GetItem: PK=`USER#<userId>`, SK=`RADAR#<YYYY-MM>` |
| カード単体取得 | Main Table GetItem: PK=`CARD#<cardId>`, SK=`METADATA` |
| リアクション一覧 | Main Table Query: PK=`CARD#<cardId>`, SK begins_with `REACTION#` |
| RadarAgg 更新 | Main Table UpdateItem: ADD competencies.\<comp\> 1（原子的加算） |

### RadarAgg — Write-time 集計

マイページを開くたびにカードを全件スキャンして集計（Read-time）ではなく、カードにコンピテンシーが付与された瞬間に RadarAgg アイテムを原子的加算（ADD）で更新する。レーダーチャート表示は常に GetItem 1回で完了。

```typescript
// aiWorker 内での更新
for (const recipientId of card.recipientIds) {
  await RadarAggEntity.update({ userId: recipientId, yearMonth })
    .add({ competencies: { [competency]: 1 } })  // 原子的加算
    .go()
}

// GET /users/me/radar?month=2026-03 はこれだけで返せる
const { data } = await RadarAggEntity.get({ userId, yearMonth }).go()
```

---

## コード品質・開発規約

### Linter / Formatter 構成

- **Oxlint** — Rust 製の高速 Linter。ESLint の 50〜100 倍高速
- **ESLint + eslint-plugin-vue** — Vue テンプレート固有のルール。`eslint-plugin-oxlint` でルール重複を自動排除
- **Prettier** — Vue SFC の `<template>` / `<style>` を含むフォーマットが安定

実行順序: oxlint → eslint → prettier。コミット時は `lint-staged` で変更ファイルのみ実行。

### Git ワークフロー自動化

- **husky + lint-staged** — Git コミット時に変更ファイルを自動で lint + format
- **CI Lint チェック必須** — PR 作成時に lint・型チェック・テストを自動実行。通過しなければマージ不可
- **Conventional Commits** — `feat:` / `fix:` / `docs:` / `refactor:` 等のプレフィクスを推奨（強制なし）。commitlint は外販確定時に導入検討
- **ブランチ命名規約** — `feature/` / `fix/` / `chore/` / `docs/` のプレフィックス必須

---

## テスト戦略

- **ユニットテスト（Vitest）** — ビジネスロジック（コンピテンシー判定ルール・バッジ付与条件・ストリーク計算など）
- **インテグレーションテスト** — API エンドポイント単位。Hono の `testClient` を使用
- **E2E テスト（Playwright）** — MVPから導入。プロジェクトルートの `e2e/` に配置し、主要ユーザーフローをカバー

---

## 環境分離・インフラ管理

- **ステージ構成:** dev（ローカル検証用）・staging（結合テスト・レビュー用）・prod（本番）の3段階。SST のステージ機能で切り替え
- **設定・シークレット管理:** SST の Config 機能 または AWS Systems Manager Parameter Store

### Bedrock 用途別モデル使い分け

- カード文面提案（MVP後）: Sonnet級（表現力重視・ストリーミング対応）
- コンピテンシー自動分類・コンテンツフィルター: Haiku / Nova Micro 級（定型タスク・高速応答）
- 感謝トレンド分析: Sonnet級（月1バッチ）

---

## 月額コスト試算（MVP時）

60名規模・月 3,000 リクエスト程度を想定。MVPスコープ（コンテンツフィルタ + コンピテンシー自動判定のみ）。

| サービス | 月額 |
|---------|------|
| S3 + CloudFront | ~$1 |
| Lambda | $0（無料枠内） |
| DynamoDB | ~$1 |
| Cognito | $0（5万ユーザー無料） |
| Bedrock (AI API) | ~$1（フィルタ+分類のみ） |
| その他 (Route53等) | ~$2 |
| **合計** | **$5-7** |

予算 50 USD に対して7〜10倍の余裕がある。文面提案（Sonnet級）をMVP後に追加した場合は月 $3〜5 の増加を見込む。

---

## 分析基盤・OLAP設計

DynamoDB (OLTP) のデータを S3 にエクスポートし、アドホックに分析する構成。管理者向けのWebダッシュボードは作らない。

**分析ツールスタック（確定）:** marimo + polars + plotly でアドホックな分析スクリプトを作成し、リポジトリの `etl/` ディレクトリで管理する。追加コスト $0。
- **marimo** — リアクティブPythonノートブック。Jupyter より再現性・共有性が高い
- **polars** — 高速データフレームライブラリ。DynamoDB JSON のフラット化変換も担当
- **plotly** — インタラクティブなチャート生成

**ETL方式（検討中）:** DynamoDB Export to S3（ネイティブ機能・Lambda不要）を採用予定。エクスポートデータはDynamoDB JSON形式（型記述子付き）のため、marimo スクリプト内で polars を使いフラット化する。頻度はオンデマンドで開始。

blocked カードの分析・AIプロンプト改善はOLAP側で行う（管理者向けWeb UIは作らない）。

---

## セキュリティ設計

- **レート制限** — API Gateway スロットリング + Hono ミドルウェアでユーザー単位のカード送信頻度を制限（例: 1日20件まで）
- **入力サニタイズ / XSS対策** — Vue の `{{ }}` でHTMLエスケープ。`v-html` は使用禁止。バックエンドでも Zod スキーマで入力長・文字種を制限
- **権限管理（isAdmin）** — Cognito のカスタム属性 or グループで管理。権限判定は必ずバックエンド（JWT検証）で行う
- **AWS WAF** — MVPでは不要（社内60名・認証必須でリスク低）。外販時に~$5/月で導入を検討
- **IAM 最小権限** — 各 Lambda 関数のIAMロールは必要なリソースへのアクセスのみ許可。SST v3 の `link` 機能で自動的に最小権限ポリシーを生成

---

## 外販時の拡張機能（設計上の備え）

外販フェーズで必要になる機能。MVP段階から拡張しやすい設計を意識する。

- **管理者向けUI** — テナント管理・ユーザー管理・コンピテンシーラベル登録・フィルタNG確認・カード復旧
- **コンピテンシーラベル登録** — テナントごとにカスタマイズ可能なラベル設定
- **分析ダッシュボード可視化** — marimo アドホック分析から QuickSight or 管理画面内ダッシュボードへ移行
- **ID/パスワード認証** — oidc-client-ts 採用により認証SDK側の変更なしで対応可能
- **二段階認証 / パスキー** — TOTP / SMS OTP / FIDO2 WebAuthn。Cognito MFA + oidc-client-ts で対応
- **マルチテナント** — DynamoDB PK に `TENANT#<tenantId>|` プレフィクス付与。環境分離はアカウント分離へ移行。AWS WAF 追加

> **設計方針:** 外販時の拡張を見据えた備えは行うが、YAGNI を優先。oidc-client-ts の採用（IdP切り替え対応）、REST互換API（Hono RPC）、DynamoDBのマルチテナントキー設計の想定など、追加コスト0で将来の拡張性を確保できる選択のみをMVP段階で行う。
