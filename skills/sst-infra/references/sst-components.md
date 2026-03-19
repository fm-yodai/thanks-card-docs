# SST v3 AWS Components Reference

Detailed reference for SST v3 AWS component configuration.
For full API docs, run `sst dev` and check the SST Console, or see https://sst.dev/docs/components/.

## Table of Contents

- [Function options](#function-options)
- [ApiGatewayV2 options](#apigatewayv2-options)
- [Dynamo options](#dynamo-options)
- [StaticSite options](#staticsite-options)
- [CognitoUserPool options](#cognitouserpool-options)
- [Cron schedule expressions](#cron-schedule-expressions)
- [Transform pattern](#transform-pattern)
- [Outputs and references](#outputs-and-references)
- [Dev mode specifics](#dev-mode-specifics)

## Function Options

```typescript
new sst.aws.Function('Name', {
  // Required
  handler: 'src/path/to/file.functionName',

  // Runtime (default: nodejs22.x)
  runtime: 'nodejs22.x' | 'nodejs20.x' | 'python3.12' | 'python3.11',

  // Resources
  timeout: '30 seconds',     // Max: '15 minutes' (Lambda limit)
  memory: '256 MB',          // Range: '128 MB' to '10240 MB'

  // Linking
  link: [table, secret, bucket],

  // Environment variables (plain strings only)
  environment: {
    NODE_OPTIONS: '--enable-source-maps',
  },

  // IAM permissions beyond what link provides
  permissions: [
    {
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    },
  ],

  // VPC (for private resources)
  vpc: myVpc,

  // Architecture
  architecture: 'arm64' | 'x86_64',  // arm64 is cheaper

  // Layers
  layers: ['arn:aws:lambda:...'],

  // Bundling
  nodejs: {
    install: ['sharp'],       // Native modules to install
    esbuild: {                // esbuild options
      external: ['@aws-sdk/*'],
    },
  },

  // Logging
  logging: {
    retention: '1 week',     // CloudWatch log retention
  },
})
```

### Handler path convention

```
'apps/api/src/routes/cards.handler'
 ^^^^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^
 File path (from project root)  Export name
```

The file path is relative to the project root. The function name after `.` is the named export.

## ApiGatewayV2 Options

```typescript
const api = new sst.aws.ApiGatewayV2('Api', {
  // Custom domain
  domain: {
    name: 'api.example.com',
    dns: sst.aws.dns(),
  },

  // CORS
  cors: {
    allowOrigins: ['https://example.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['content-type', 'authorization'],
    allowCredentials: true,
  },

  // Access logging
  accessLog: {
    retention: '1 month',
  },

  // Transform
  transform: {
    api: {
      // Pulumi API Gateway props
    },
  },
})

// Route methods
api.route('GET /items', handler)
api.route('POST /items', handler)
api.route('PUT /items/{id}', handler)
api.route('DELETE /items/{id}', handler)
api.route('$default', handler)  // Catch-all (for Hono/Express routers)

// Route with function config
api.route('POST /items', {
  handler: 'src/create.handler',
  timeout: '60 seconds',
  memory: '512 MB',
  link: [table],
})

// Outputs
api.url      // The API endpoint URL
api.nodes    // Underlying Pulumi resources
```

## Dynamo Options

```typescript
const table = new sst.aws.Dynamo('Name', {
  // Field definitions (only key attributes need declaration)
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
    gsi1sk: 'string',
    gsi2pk: 'string',
    gsi2sk: 'string',
  },

  // Primary index
  primaryIndex: {
    hashKey: 'pk',
    rangeKey: 'sk',   // Optional sort key
  },

  // Global Secondary Indexes
  globalIndexes: {
    'gsi1pk-gsi1sk-index': {
      hashKey: 'gsi1pk',
      rangeKey: 'gsi1sk',
      projection: 'all',    // 'all' | 'keys-only' | ['attr1', 'attr2']
    },
    'gsi2pk-gsi2sk-index': {
      hashKey: 'gsi2pk',
      rangeKey: 'gsi2sk',
    },
  },

  // Local Secondary Indexes
  localIndexes: {
    'lsi1-index': {
      rangeKey: 'lsi1sk',
    },
  },

  // DynamoDB Streams (required for .subscribe())
  stream: 'new-and-old-images' | 'new-image' | 'old-image' | 'keys-only',

  // Transform underlying resource
  transform: {
    table: {
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: { enabled: true },
      ttl: { attributeName: 'expiresAt', enabled: true },
    },
  },
})

// Subscribe to stream
table.subscribe('SubscriberName', {
  handler: 'src/subscriber.handler',
  link: [table],
  timeout: '5 minutes',
  filters: [
    {
      eventName: ['INSERT'],  // 'INSERT' | 'MODIFY' | 'REMOVE'
      dynamodb: {
        NewImage: {
          status: { S: ['processing'] },
        },
      },
    },
  ],
})

// Outputs
table.name   // DynamoDB table name
table.arn    // DynamoDB table ARN
```

## StaticSite Options

```typescript
const site = new sst.aws.StaticSite('Name', {
  path: 'apps/web',           // Path to frontend project

  build: {
    command: 'pnpm build',     // Build command
    output: 'dist',            // Build output directory
  },

  // Inject env vars at build time (Vite uses VITE_ prefix)
  environment: {
    VITE_API_URL: api.url,
    VITE_COGNITO_USER_POOL_ID: userPool.id,
    VITE_COGNITO_CLIENT_ID: client.id,
  },

  // Custom domain
  domain: {
    name: 'example.com',
    dns: sst.aws.dns(),
  },

  // SPA fallback (index.html for all routes)
  errorPage: 'redirect_to_index_page',

  // Transform
  transform: {
    cdn: {
      // CloudFront distribution settings
    },
  },
})

// Outputs
site.url     // CloudFront URL
```

## CognitoUserPool Options

```typescript
const userPool = new sst.aws.CognitoUserPool('Auth', {
  // Lambda triggers
  triggers: {
    preAuthentication: 'src/auth/pre-auth.handler',
    postConfirmation: 'src/auth/post-confirmation.handler',
    preTokenGeneration: 'src/auth/pre-token.handler',
    customMessage: 'src/auth/custom-message.handler',
  },

  // Transform
  transform: {
    userPool: {
      autoVerifiedAttributes: ['email'],
      schemas: [
        {
          name: 'email',
          attributeDataType: 'String',
          required: true,
        },
      ],
    },
  },
})

// Add OAuth client
const client = userPool.addClient('WebClient', {
  transform: {
    client: {
      supportedIdentityProviders: ['COGNITO', 'Google'],
      callbackUrls: ['http://localhost:5173/callback'],
      logoutUrls: ['http://localhost:5173/login'],
      allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['openid', 'email', 'profile'],
    },
  },
})

// Add identity provider
userPool.addIdentityProvider('Google', {
  type: 'google',
  details: {
    clientId: googleClientId.value,
    clientSecret: googleClientSecret.value,
    authorize_scopes: 'openid email profile',
  },
})

// Outputs
userPool.id       // User Pool ID
userPool.arn      // User Pool ARN
client.id         // Client ID
```

## Cron Schedule Expressions

```typescript
// Cron expression: cron(minutes hours day-of-month month day-of-week year)
'cron(0 9 * * ? *)'     // Every day at 09:00 UTC
'cron(0 0 1 * ? *)'     // First day of every month at 00:00 UTC
'cron(0/15 * * * ? *)'  // Every 15 minutes

// Rate expression
'rate(5 minutes)'
'rate(1 hour)'
'rate(1 day)'
```

## Transform Pattern

Every SST component supports `transform` to modify the underlying Pulumi/AWS resources:

```typescript
new sst.aws.Dynamo('Table', {
  // ... SST config ...
  transform: {
    table: {
      // These are raw Pulumi AWS DynamoDB Table props
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: { enabled: true },
      tags: { Environment: $app.stage },
    },
  },
})
```

This is the escape hatch for settings SST doesn't expose directly.

## Outputs and References

```typescript
async run() {
  const api = new sst.aws.ApiGatewayV2('Api')
  const site = new sst.aws.StaticSite('Web', { ... })

  // Return outputs — accessible via `sst shell` and SST Console
  return {
    apiUrl: api.url,
    siteUrl: site.url,
  }
}
```

Access outputs:
```bash
# In terminal
sst shell -- printenv | grep SST

# In scripts
sst shell -- node -e "console.log(process.env.SST_OUTPUT_apiUrl)"
```

## Dev Mode Specifics

`sst dev` provides live Lambda development with hot reload:

- Lambda functions run in your AWS account but are proxied through a local WebSocket connection
- Changes to function code are reflected instantly (no redeploy needed)
- Infrastructure changes (adding new resources) require restarting `sst dev`
- `sst dev` runs the `dev` command defined for linked frontends automatically

```typescript
// DevCommand for frontend dev server
new sst.aws.StaticSite('Web', {
  // ...
  dev: {
    command: 'pnpm dev',
    directory: 'apps/web',
  },
})
```

The dev mode URL is different from the deployed URL. Use `api.url` in `environment` to inject the correct URL for each stage.
