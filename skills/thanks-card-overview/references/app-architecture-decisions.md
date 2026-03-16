# アプリケーションアーキテクチャ設計ノート

モノレポ全体構造と apps/web・apps/api・packages/ の内部設計を定義するドキュメント。
AWS構成の上に乗るアプリケーションの設計判断を記録している。
既存の設計ノート（architecture-techselection）のディレクトリ構造を白紙にし、ゼロベースで再設計した結果。

- ステータス: 確定（Sprint 0）
- 前提: Vue 3 / Hono / DynamoDB / SST v3
- 対象: 開発メンバー・AIエージェント

---

## 設計原則

すべての構造的判断は以下の3原則から導出される。

1. **1操作 = 1ファイル** — UseCaseもfeatureも、変更の単位を小さく閉じる。AIコーディングエージェントがスコープを特定しやすく、PRレビューも明快になる。
2. **依存は上から下へだけ** — route → UseCase → Domain → Repository（実装）の一方向。Repository interface はドメイン層に定義し依存性を逆転（DIP）。feature間も直接importしない。循環依存を構造で防ぐ。
3. **契約は shared に集約** — Zodスキーマ・エラー型・定数は packages/shared に。フロントとバックが同一の型から生成された定義を参照する。ズレが原理的に起きない。

> **AIエージェント最適化:** この構造は Claude Code / GitHub Copilot 等のAIコーディングエージェントが「このファイルを変更すれば良い」と即座に判断できることを重視している。1ファイル1責務、コンストラクタでの明示的な依存宣言、featureの公開API（index.ts）がエージェントのコンテキスト精度を高める。

---

## モノレポ全体構造

pnpm workspaceによるモノレポ。

```
thanks-card/
├── apps/web/              ← Vue 3 + Vite（SPA）
├── apps/api/              ← Hono on Lambda（HTTP API + Worker）
├── packages/shared/       ← Zodスキーマ・エラー型・定数
├── packages/db/           ← ElectroDB エンティティ定義
├── packages/config/       ← 共有 tsconfig・ESLint（Oxlint）・Prettier
├── infra/                 ← SST v3 IaC（Lambda, DynamoDB, CloudFront 等）
├── etl/                   ← Python（EventBridge → S3 Parquet エクスポート）
├── e2e/                   ← Playwright E2Eテスト
└── pnpm-workspace.yaml
```

### パッケージ間の依存関係

- apps/web → packages/shared ← apps/api
- apps/api → packages/db → packages/shared
- **apps/web は packages/db に依存しない**（フロントからDBスキーマへの直接参照を構造で防止）

### 補助パッケージ

| パッケージ | 役割 |
|-----------|------|
| packages/config | tsconfig.base.json・ESLint（Oxlint + ESLint）・Prettierの共有設定を集約 |
| infra/ | SST v3でAWSリソースを定義（Lambda, DynamoDB, CloudFront, Cognito等） |
| etl/ | Python製の分析用データエクスポート。EventBridgeスケジュールで定期実行 |

---

## apps/api 設計

Hono on Lambda。HTTP APIとWorker Lambdaを同一パッケージに統合し、UseCase・Repositoryを共有する。エントリポイントだけが異なる。

### レイヤー構造

1. **routes/ ・ handlers/** — HTTPエントリ / Workerエントリ。Zodバリデーション → UseCase委譲のみ
2. **use-cases/** — 1操作 = 1クラス = 1ファイル。オーケストレーション（ドメインモデル操作 + Repository呼び出し）のみ
3. **domain/** — ドメインモデル（状態遷移・バリデーション）・Repository interface・ドメインイベント定義
4. **repositories/ ・ services/** — データアクセス（domain/interfaces の実装） / 外部API（Bedrock, SES）
5. **lib/ ・ di/** — DBクライアント・ロガー / container.ts（composition root）

### ディレクトリ構造

```
apps/api/src/
├── routes/                  ← HTTP APIエントリ（Hono）
│   ├── cards.ts             ← カードCRUD
│   ├── users.ts             ← ユーザー情報
│   └── timeline.ts          ← タイムライン取得
├── handlers/                ← Worker Lambdaエントリ
│   ├── ai-labeler.ts        ← DynamoDB Streams → AI判定
│   ├── notifier.ts          ← SES通知送信
│   └── batch.ts             ← 定期バッチ処理
├── middleware/              ← Honoミドルウェア
│   ├── auth.ts              ← JWT検証
│   ├── error-handler.ts     ← AppError → HTTPレスポンス変換
│   ├── logger.ts            ← リクエストロギング
│   └── tenant.ts            ← テナントID解決（MVP: 固定値、将来: JWTから抽出）
├── use-cases/               ← オーケストレーション（1操作 = 1ファイル）
│   ├── card/                ← カード送受信コンテキスト
│   │   ├── SendCard.ts
│   │   └── GetTimeline.ts
│   ├── labeling/            ← AIラベリングコンテキスト
│   │   └── LabelCard.ts
│   ├── user/                ← ユーザー管理コンテキスト
│   │   └── GetProfile.ts
│   └── notification/        ← 通知コンテキスト
│       ├── NotifyRecipient.ts
│       └── RunBatch.ts
├── domain/                  ← ドメイン層（ビジネスルール・不変条件）
│   ├── models/              ← ドメインモデル（状態遷移・バリデーション）
│   │   ├── Card.ts          ← CardStatus遷移ルール・送信上限チェック
│   │   └── User.ts          ← プロフィール不変条件・レーダー集計更新
│   ├── events/              ← ドメインイベント定義
│   │   ├── CardSent.ts      ← カード送信時に発行
│   │   └── CardLabeled.ts   ← AI判定完了時に発行
│   └── interfaces/          ← Repository / Service の interface（依存性逆転）
│       ├── CardRepository.ts
│       ├── UserRepository.ts
│       └── AiService.ts
├── repositories/            ← domain/interfaces の DynamoDB 実装
│   ├── card.dynamo.repository.ts
│   └── user.dynamo.repository.ts
├── services/                ← domain/interfaces の外部API実装
│   ├── ai.bedrock.service.ts
│   └── notification.ses.service.ts
├── lib/                     ← インフラ基盤
│   ├── dynamo-client.ts
│   ├── logger.ts
│   └── config.ts
├── di/                      ← 依存性注入
│   └── container.ts         ← composition root
└── index.ts                 ← Honoアプリのエクスポート
```

### 各層の責務ルール

| 層 | 責務 | 禁止事項 |
|----|------|---------|
| routes/ | リクエスト受付・Zodバリデーション・UseCaseへの委譲・レスポンス整形 | ビジネスロジック、DB直接アクセス |
| handlers/ | SQS/Streams イベントのパース・UseCaseへの委譲 | ビジネスロジック、DB直接アクセス |
| use-cases/ | オーケストレーション。ドメインモデルの操作とRepository/Service呼び出しの調整 | ビジネスルールの直接実装、HTTP関連の知識 |
| **domain/** | ビジネスルール・不変条件の保持。状態遷移・バリデーション・ドメインイベント定義。Repository/Serviceのinterface定義（依存性逆転） | インフラ知識（DB固有API、HTTP）、外部ライブラリへの依存 |
| repositories/ | domain/interfaces の DynamoDB 実装。データの永続化・取得 | ビジネスロジック、他Repositoryへの依存 |
| services/ | domain/interfaces の外部API実装（Bedrock, SES） | ビジネスロジック |
| di/ | 全依存関係の組み立て。「具体実装を知る」唯一の場所 | ビジネスロジック |

### 設計上の注記

- **RDS移行パス:** DynamoDB → RDS に切り替える場合、`card.rds.repository.ts` を追加し `di/container.ts` の注入先を差し替えるだけで完了する
- **DI方式:** コンストラクタ注入 + composition root。DIライブラリ（tsyringe等）は不使用。依存が明示的でテスト時のモック差し込みが容易
- **ドメイン層（軽量ドメインモデル）:** Card モデルは状態遷移メソッド（`publish()`, `block(reason)`）を持ち、不正な遷移を実行時に防止。貧血ドメインモデルを構造的に防ぐ
- **Bounded Context（論理境界）:** use-cases/ 内をコンテキスト単位でサブディレクトリ分割。カード送受信・AIラベリング・ユーザー管理・通知の4境界。AIラベリングは将来の別サービス切り出し候補

---

## apps/web 設計

Vue 3 SPA。Feature-basedディレクトリ構造。状態管理はTanStack Query + composable（Pinia不使用）。

### データフロー

api/ (Hono RPC) → TanStack Query → composable → component（一方向。逆方向の依存は禁止）

### ディレクトリ構造

```
apps/web/src/
├── pages/                   ← ルート対応ページ（薄い: layout + feature組み合わせ）
│   ├── HomePage.vue
│   ├── SendPage.vue
│   ├── TimelinePage.vue
│   ├── ProfilePage.vue
│   └── AdminPage.vue
├── features/                ← 機能単位の自己完結モジュール
│   ├── card/                ← カード送信・表示
│   │   ├── components/      ← CardComposer.vue, ThankYouCard.vue
│   │   ├── composables/     ← useCardSend.ts, useCardDetail.ts
│   │   ├── queries/         ← cardKeys.ts, useCardListQuery.ts
│   │   ├── types/           ← feature-local types（必要時のみ）
│   │   ├── __tests__/       ← CardComposer.test.ts
│   │   └── index.ts         ← 公開API（他featureはここからのみimport可）
│   ├── timeline/            ← タイムライン表示・フィルタ
│   ├── analytics/           ← 分析・レポート
│   └── auth/                ← ログイン・認証
├── components/
│   └── ui/                  ← デザインシステムL2 / shadcn-vue ベース
├── composables/             ← feature横断の共有composable
│   ├── useAuth.ts
│   ├── useCurrentUser.ts
│   └── useTenant.ts
├── api/                     ← Hono RPCクライアント生成（型安全なAPIコール）
├── router/                  ← Vue Router + ナビゲーションガード
├── layouts/                 ← AppLayout.vue, AuthLayout.vue
├── plugins/                 ← queryClient setup
└── main.ts
```

### feature間ルール

- **直接importは禁止:** `card/` が `timeline/` のファイルを直接参照しない。連携は `index.ts` の公開APIを通じて行う
- **index.ts で公開APIを明示:** 各featureは外部に公開するコンポーネント・composable・型を明示。内部のファイルは外から見えない
- **queries/ はfeature内に閉じる:** TanStack Queryのquery key定義とhookをfeature内に持つ。キャッシュの管理単位が機能に紐づく

### 設計上の注記

- **Pinia不使用:** サーバー状態はTanStack Queryが管理。UIローカル状態はcomposableのrefで十分
- **Hono RPC:** `hc<AppType>()` でバックエンドのルート定義から型安全なクライアントを自動生成。Zodスキーマ → Honoルート型 → RPCクライアント → TanStack Queryの一気通貫
- **テスト戦略:** Vitest（feature内 `__tests__/`）+ Playwright（`e2e/`）をMVPから導入

---

## packages/shared 設計

フロントとバックの「契約」とドメイン共有型を定義する場所。Zodスキーマが全ての型の起点（Single Source of Truth）。

### ディレクトリ構造

```
packages/shared/src/
├── contracts/               ← API契約（リクエスト/レスポンスのZodスキーマ）
│   ├── card.contract.ts     ← CreateCardInput, CardResponse, CardListResponse
│   ├── user.contract.ts     ← UserProfileResponse, MemberListResponse
│   └── timeline.contract.ts ← TimelineQuery, PaginatedResponse
├── domain-types/            ← ドメイン共有型（フロント・バック共通で参照する値の定義）
│   ├── card-status.ts       ← CardStatus enum: processing / published / blocked
│   └── competency.ts        ← CompetencyId (enum: 5値), CompetencyMeta
├── errors/                  ← 共通エラー型（discriminated union）
│   ├── app-error.ts         ← AppErrorクラス + エラーコード定義
│   └── error-response.schema.ts ← ErrorResponseSchema + isAppError() type guard
├── constants/               ← コンピテンシー定義・上限値・テナント設定
├── utils/                   ← 日付フォーマッター・ID生成
└── index.ts                 ← 全re-export
```

### エラー型設計

| コード | HTTP | 意味 | フロントUI |
|--------|------|------|-----------|
| VALIDATION | 400 | 入力不正（Zodバリデーション失敗） | フィールド単位のインラインエラー |
| UNAUTHORIZED | 401 | 未ログイン・トークン期限切れ | ログイン画面へリダイレクト |
| FORBIDDEN | 403 | 権限不足 | 権限エラーToast |
| BUSINESS | 409 | ビジネスルール違反（送信上限等） | 説明付きToast |
| EXTERNAL | 502 | 外部サービス障害（AI API等） | リトライ促すToast |

- **AIブロックはエラー型に含めない。** AIラベリングは非同期実行。ブロック判定はカードの状態遷移（`status: 'blocked'`）として扱い、メール通知で送信者に伝える

### CardStatus 状態遷移

- processing → published（AI判定完了、適切）
- processing → blocked（AI判定完了、不適切）
- 送信直後は processing。MVPでは blocked → published の復旧機能は未実装
- 遷移ルールは `domain/models/Card.ts` の `publish()` / `block(reason)` メソッドで強制

---

## packages/db 設計

ElectroDB を用いた DynamoDB エンティティ定義。Single Table Design。

### ディレクトリ構造

```
packages/db/src/
├── entities/                ← ElectroDB エンティティ定義
│   ├── card.entity.ts       ← PK: USER#id  SK: CARD#ulid
│   ├── user.entity.ts       ← PK: USER#id  SK: PROFILE
│   ├── timeline.entity.ts   ← GSI1: TIMELINE#tenantId  SK: ulid（降順）
│   └── radar-agg.entity.ts  ← PK: USER#id  SK: RADAR（書き込み時集計）
├── service.ts               ← ElectroDB Service（全エンティティを束ねる）
├── client.ts                ← DynamoDB クライアント生成
└── index.ts                 ← 全re-export
```

### Repositoryとの関係

UseCase → Repository (interface) → ElectroDB Entity → DynamoDB

- Repository の DynamoDB 実装が packages/db の ElectroDB エンティティを利用。UseCase は Repository interface のみに依存
- **3層のスキーマ棲み分け:** shared/contracts（API入出力の形）、shared/domain-types（フロント・バック共通のドメイン概念）、db（バックエンド専用の永続化スキーマ）

---

## 非同期ラベリング設計

送信即完了 → AIラベルは後から自然に表示。TanStack Queryのスマートポーリングで実現（SSEは見送り）。

### SSEを見送った理由

- Lambda 29秒制限でSSEの持続接続が不可
- WebSocket APIの追加は月$50の予算下でオーバーエンジニアリング
- TanStack Queryのスマートポーリング + window focus refetchで十分なUXを実現可能

### 3フェーズフロー

1. **Phase 1: 送信（即時）** — APIがDynamoDBに保存→即レスポンス。optimistic updateでタイムラインにカード即表示。ラベル部分は「ラベリング中...」のシマー表示
2. **Phase 2: AI処理（非同期）** — DynamoDB Streams → Worker Lambda → Bedrock → 結果をDynamoDBに書き戻し
3. **Phase 3: フロント反映** — TanStack Queryのポーリングでキャッチ。ラベルがCSSトランジションでフェードイン

### 2つのポーリング戦略

| 戦略 | 用途 | 設定 | 停止条件 |
|------|------|------|---------|
| A: post-send polling | 送信直後に画面を見ている人向け | `refetchInterval: 5s`（最大60秒） | competenciesフィールドが埋まったら停止 |
| B: background freshness | 別画面から戻ってきた人向け | `refetchOnWindowFocus: true`, `staleTime: 30s` | 常時有効 |

### 設計上の注記

- **ドメインイベント:** 非同期フローは `CardSent`, `CardLabeled` としてドメインに定義。インフラ（DynamoDB Streams）を差し替えてもドメインロジックは不変
- **UXディテール:** ラベル未確定はシマー表示、確定時にCSSトランジション（opacity 0→1, 300ms ease）でフェードイン

---

## 設計判断ログ（ADR一覧）

| ID | 判断 | 選択 | 根拠 |
|----|------|------|------|
| ADR-01 | バックエンド構造 | Route → UseCase → Repository 3層 | RDS移行可能性に備えた抽象化 |
| ADR-02 | UseCase粒度 | 1操作 = 1クラス = 1ファイル | AIエージェントのスコープ特定容易性 |
| ADR-03 | DI方式 | コンストラクタ注入 + composition root | ライブラリ不要でシンプル |
| ADR-04 | Worker配置 | apps/api内に統合（エントリポイント分離） | UseCase/Repository共有のimportが簡潔 |
| ADR-05 | フロント構造 | Feature-based ディレクトリ | 影響範囲を最小化 |
| ADR-06 | ルーティング | Vue Router（ファイルベースなし） | 明示的でコントロールしやすい |
| ADR-07 | 状態管理 | TanStack Query + composable（Pinia不使用） | 状態の所在がシンプル |
| ADR-08 | スキーマ方針 | Zodスキーマ → z.infer で型生成 | Single Source of Truth |
| ADR-09 | エラー型 | discriminated union（5カテゴリ） | code→UIのマッピングが明確 |
| ADR-10 | AIブロック扱い | エラーではなくCardStatusの状態遷移 | 非同期判定なのでフロントエラーフローに載せない |
| ADR-11 | 非同期ラベリング | TanStack Queryスマートポーリング（5秒） | Lambda 29秒制限でSSE不可 |
| ADR-12 | マルチテナント | データ層にテナントIDプレフィクス | MVPはシングルテナント、外販フェーズでJWT切替 |
| ADR-13 | テスト戦略 | Vitest + Playwright（MVPから導入） | feature内__tests__でVitest、e2e/でPlaywright |
| ADR-14 | DBアクセス層 | ElectroDB（packages/db） | Single Table Designの型安全な管理 |
| ADR-15 | CardStatus初期値 | processing → published / blocked | 送信=即公開（下書き機能なし） |
| ADR-16 | ドメイン層の導入 | 軽量ドメインモデル | 貧血ドメインモデル防止 |
| ADR-17 | Repository interface 配置 | domain/interfaces/ に定義 | 依存性逆転の原則をディレクトリ構造で強制 |
| ADR-18 | CardStatus 遷移保護 | domain/models/Card.ts のメソッドで強制 | 不正遷移を構造的に防止 |
| ADR-19 | shared 内部構造 | contracts/ + domain-types/ に分離 | API契約とドメイン概念は異なる関心事 |
| ADR-20 | 集約境界 | Card集約, User集約 | トランザクション境界の明確化 |
| ADR-21 | ドメインイベント | domain/events/ に CardSent / CardLabeled | 非同期フローのドメインモデリング |
| ADR-22 | Bounded Context | use-cases/ をコンテキスト単位で分割 | 4境界（カード・ラベリング・ユーザー・通知） |
