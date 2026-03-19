---
name: sst-infra
description: >-
  SST v3 (Ion) infrastructure-as-code guide for AWS serverless applications.
  Covers sst.config.ts structure, AWS components (Function, ApiGatewayV2, Dynamo, Cron,
  Queue, Bucket, StaticSite, CognitoUserPool), resource linking, secrets management,
  stages, CLI commands, and deployment workflows.
  Use this skill whenever working on sst.config.ts, infra/ directory, IaC definitions,
  AWS resource provisioning, deployment configuration, environment variables, secrets,
  or any infrastructure-related task — even if the user just mentions "deploy", "infra",
  "stage", "environment", or "config".
---

# SST v3 (Ion)

SST v3 is a framework for defining and deploying full-stack applications on AWS. It uses Pulumi under the hood but exposes a simpler component API. All infrastructure is defined in TypeScript in `sst.config.ts`.

## Important: SST v3 vs v2

SST v3 (Ion) is a complete rewrite from v2. Key differences:

| Aspect | SST v2 (Constructs) | SST v3 (Ion) |
|--------|---------------------|--------------|
| Engine | AWS CDK | Pulumi/Terraform |
| Config | `stacks/` directory | Single `sst.config.ts` |
| Components | `new Table(stack, ...)` | `new sst.aws.Dynamo(...)` |
| Subscribers | `.addConsumers()` | `.subscribe()` |
| Linking | `bind: [...]` | `link: [...]` |
| SDK import | `import { Config } from 'sst/node/config'` | `import { Resource } from 'sst'` |

Never generate SST v2 code. Always use the v3 patterns below.

## sst.config.ts Structure

```typescript
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'thanks-card',
      removal: input.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input.stage),
      home: 'aws',
      providers: {
        aws: {
          region: 'ap-northeast-1',
        },
      },
    }
  },
  async run() {
    // Define resources here
    const table = new sst.aws.Dynamo('MainTable', {
      fields: {
        pk: 'string',
        sk: 'string',
        gsi1pk: 'string',
        gsi1sk: 'string',
      },
      primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
      globalIndexes: {
        'gsi1pk-gsi1sk-index': {
          hashKey: 'gsi1pk',
          rangeKey: 'gsi1sk',
        },
      },
      stream: 'new-and-old-images',
    })

    const api = new sst.aws.ApiGatewayV2('Api')
    api.route('$default', {
      handler: 'apps/api/src/index.handler',
      link: [table],
    })

    return { apiUrl: api.url }
  },
})
```

### Key rules for sst.config.ts

- The `run()` function is `async` — you can use `await`.
- Do not `import` AWS provider packages directly. SST manages them via the `sst.aws.*` namespace.
- Return an object from `run()` to expose outputs (URLs, ARNs, etc.).
- Use `input.stage` in `app()` to configure stage-specific behavior.

## AWS Components

### Function

```typescript
const fn = new sst.aws.Function('MyFunction', {
  handler: 'src/handler.main',
  runtime: 'nodejs22.x',
  timeout: '30 seconds',
  memory: '256 MB',
  link: [table, secret],
  environment: {
    CUSTOM_VAR: 'value',
  },
  permissions: [
    {
      actions: ['ses:SendEmail'],
      resources: ['*'],
    },
  ],
})
```

### ApiGatewayV2

```typescript
const api = new sst.aws.ApiGatewayV2('Api')

// Single handler for all routes (monolithic Hono app)
api.route('$default', {
  handler: 'apps/api/src/index.handler',
  link: [table],
  timeout: '30 seconds',
})

// Or individual routes
api.route('GET /users', 'src/routes/users.list')
api.route('POST /cards', {
  handler: 'src/routes/cards.create',
  link: [table],
})

// Custom domain
api.route('$default', 'src/index.handler')
// api.url gives you the endpoint URL
```

### Dynamo

```typescript
const table = new sst.aws.Dynamo('MainTable', {
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
    gsi1sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  globalIndexes: {
    'gsi1pk-gsi1sk-index': {
      hashKey: 'gsi1pk',
      rangeKey: 'gsi1sk',
    },
  },
  // Enable DynamoDB Streams
  stream: 'new-and-old-images',
  // Transform underlying Pulumi resource
  transform: {
    table: {
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: { enabled: true },
    },
  },
})

// Subscribe to stream events
table.subscribe('AiWorker', {
  handler: 'apps/api/src/handlers/ai-worker.handler',
  link: [table],
  timeout: '5 minutes',
  // Filter to only INSERT events
  filters: [
    {
      eventName: ['INSERT'],
    },
  ],
})
```

### StaticSite

```typescript
const web = new sst.aws.StaticSite('Web', {
  path: 'apps/web',
  build: {
    command: 'pnpm build',
    output: 'dist',
  },
  environment: {
    VITE_API_URL: api.url,
  },
})
```

### Cron

```typescript
new sst.aws.Cron('DailyNotifier', {
  schedule: 'cron(0 0 * * ? *)',  // Every day at 00:00 UTC
  function: {
    handler: 'apps/api/src/handlers/notifier.handler',
    link: [table],
    timeout: '5 minutes',
  },
})

// Rate expression
new sst.aws.Cron('Heartbeat', {
  schedule: 'rate(5 minutes)',
  function: 'src/heartbeat.handler',
})
```

### Queue (SQS)

```typescript
const dlq = new sst.aws.Queue('DeadLetterQueue')

const queue = new sst.aws.Queue('ProcessingQueue', {
  dlq: dlq.arn,
})

queue.subscribe('Processor', {
  handler: 'src/processor.handler',
  link: [table],
  timeout: '5 minutes',
})
```

### Bucket (S3)

```typescript
const bucket = new sst.aws.Bucket('Uploads', {
  access: 'cloudfront',  // For CDN distribution
})
```

### CognitoUserPool

```typescript
const userPool = new sst.aws.CognitoUserPool('Auth', {
  triggers: {
    postConfirmation: 'src/auth/post-confirmation.handler',
  },
})

const client = userPool.addClient('WebClient')
```

For the full component API reference, see [references/sst-components.md](references/sst-components.md).

## Resource Linking

The `link` property is SST's mechanism for granting a function access to other resources. It does two things:

1. **Grants IAM permissions** automatically (least-privilege)
2. **Injects resource properties** as environment variables accessible via the SDK

```typescript
// In sst.config.ts
const table = new sst.aws.Dynamo('MainTable', { ... })
const bucket = new sst.aws.Bucket('Uploads')

new sst.aws.Function('MyFunction', {
  handler: 'src/index.handler',
  link: [table, bucket],  // Function can access both
})
```

```typescript
// In function code
import { Resource } from 'sst'

const tableName = Resource.MainTable.name   // DynamoDB table name
const bucketName = Resource.Uploads.name     // S3 bucket name
```

The `Resource` object is fully typed — autocomplete works based on what's linked.

## Secrets

Secrets are managed via the CLI and stored encrypted per stage:

```bash
# Set a secret
sst secret set BedrockApiKey sk-abc123

# Set for a specific stage
sst secret set BedrockApiKey sk-prod456 --stage production

# List secrets
sst secret list

# Remove a secret
sst secret remove BedrockApiKey
```

```typescript
// In sst.config.ts
const bedrockKey = new sst.Secret('BedrockApiKey')

new sst.aws.Function('AiWorker', {
  handler: 'src/ai-worker.handler',
  link: [bedrockKey],
})
```

```typescript
// In function code
import { Resource } from 'sst'

const apiKey = Resource.BedrockApiKey.value
```

## Stages

Stages are isolated deployments of the same app. Each stage has its own resources.

```bash
# Local development (live Lambda with hot reload)
sst dev

# Deploy to a named stage
sst deploy --stage staging
sst deploy --stage production

# Remove a stage entirely
sst remove --stage pr-123
```

### Stage-aware configuration

```typescript
app(input) {
  return {
    name: 'thanks-card',
    // Keep resources on production delete; remove on dev
    removal: input.stage === 'production' ? 'retain' : 'remove',
    // Prevent accidental updates on production
    protect: ['production'].includes(input.stage),
    home: 'aws',
  }
},
async run() {
  // Stage-conditional resources
  const isProd = $app.stage === 'production'

  const table = new sst.aws.Dynamo('MainTable', {
    // ...
    transform: {
      table: {
        pointInTimeRecovery: { enabled: isProd },
      },
    },
  })
}
```

The `$app.stage` variable is available in `run()` to branch on the current stage.

## CLI Commands

| Command | Description |
|---------|-------------|
| `sst dev` | Start local dev mode (live Lambda, hot reload) |
| `sst deploy` | Deploy to current stage |
| `sst deploy --stage X` | Deploy to named stage |
| `sst remove` | Remove all resources for current stage |
| `sst secret set K V` | Set an encrypted secret |
| `sst secret list` | List all secrets for current stage |
| `sst shell` | Open a shell with Resource env vars loaded |
| `sst shell -- cmd` | Run a command with Resource env vars |
| `sst console` | Open the SST Console dashboard |
| `sst diff` | Preview infrastructure changes |

## Common Mistakes

1. **Importing provider packages in sst.config.ts** — SST manages provider imports. Use `sst.aws.*` components, not direct `@pulumi/aws` imports.
2. **Using SST v2 patterns** — `new Table(stack, ...)`, `bind: [...]`, `import { Config }` are all v2. Use `new sst.aws.Dynamo(...)`, `link: [...]`, `import { Resource }`.
3. **Forgetting `link`** — Without `link`, a function has no permissions and no access to `Resource.*`. Every resource a function uses must be linked.
4. **Hardcoding table names** — Use `Resource.MyTable.name` from the SST SDK, not hardcoded strings. This ensures stage isolation and correct IAM scoping.
5. **Missing `stream` on Dynamo** — DynamoDB Streams are opt-in. You must set `stream: 'new-and-old-images'` (or other mode) before calling `.subscribe()`.
6. **Using `sst remove` on production** — The `protect` and `removal: 'retain'` settings in `app()` guard against this, but always double-check the stage.
