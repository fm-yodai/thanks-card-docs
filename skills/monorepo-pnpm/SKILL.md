---
name: monorepo-pnpm
description: >-
  pnpm workspace monorepo management guide for TypeScript full-stack applications.
  Covers pnpm-workspace.yaml, workspace protocol (workspace:*), cross-package dependencies,
  shared TypeScript configuration, root scripts, package organization (apps/ + packages/),
  type sharing with Zod schemas, and common pnpm commands.
  Use this skill whenever working on workspace configuration, adding packages, managing
  cross-package dependencies, setting up shared configs, or resolving monorepo-related issues —
  even if the user just mentions "workspace", "package", "shared", "monorepo", or "dependency".
---

# pnpm Workspace Monorepo

## Structure

```
thanks-card/                        ← Repository root
├── pnpm-workspace.yaml             ← Workspace definition
├── package.json                    ← Root scripts + dev dependencies
├── tsconfig.json                   ← Root tsconfig (references)
├── apps/
│   ├── web/                        ← Vue 3 frontend (deployable)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── api/                        ← Hono backend (deployable)
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/                     ← Zod schemas + shared types (library)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── schemas/            ← Zod schema definitions
│   │       └── index.ts            ← Re-exports
│   ├── db/                         ← ElectroDB entities (library)
│   │   ├── package.json
│   │   └── src/
│   └── config/                     ← Shared tsconfig / lint / prettier configs
│       ├── tsconfig.base.json
│       ├── tsconfig.node.json
│       ├── eslint.config.js
│       └── prettier.config.js
└── e2e/                            ← Playwright E2E tests
```

- **apps/** — Deployable applications. Each has its own build pipeline.
- **packages/** — Shared libraries consumed by apps. Not deployed independently.

## pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

This tells pnpm which directories contain workspace packages. Every directory listed that has a `package.json` becomes a workspace package.

## Cross-Package Dependencies

### The workspace protocol

Use `workspace:*` to depend on a sibling package within the monorepo:

```json
// apps/api/package.json
{
  "name": "@thankscard/api",
  "dependencies": {
    "@thankscard/shared": "workspace:*",
    "@thankscard/db": "workspace:*"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@thankscard/web",
  "dependencies": {
    "@thankscard/shared": "workspace:*"
  }
}
```

```json
// packages/db/package.json
{
  "name": "@thankscard/db",
  "dependencies": {
    "@thankscard/shared": "workspace:*"
  }
}
```

`workspace:*` resolves to the local package during development. When publishing (not applicable to this project), pnpm replaces it with the actual version.

### Package naming convention

Use a consistent org scope for all workspace packages: `@thankscard/<name>`.

## Package Configuration Patterns

### packages/shared — Type sharing hub

The most important package. Zod schemas defined here are the single source of truth for both frontend and backend types.

```json
// packages/shared/package.json
{
  "name": "@thankscard/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

```typescript
// packages/shared/src/schemas/card.ts
import { z } from 'zod'

export const createCardSchema = z.object({
  recipientIds: z.array(z.string().uuid()).min(1),
  message: z.string().min(1).max(500),
  isPublic: z.boolean().default(true),
})

export type CreateCardInput = z.infer<typeof createCardSchema>
```

```typescript
// packages/shared/src/index.ts
export * from './schemas/card'
export * from './schemas/user'
// ... re-export all schemas and types
```

Usage from apps:
```typescript
// apps/api — validation
import { createCardSchema } from '@thankscard/shared'
app.post('/cards', zValidator('json', createCardSchema), ...)

// apps/web — type-safe form
import type { CreateCardInput } from '@thankscard/shared'
const formData = ref<CreateCardInput>({ ... })
```

### packages/config — Shared configurations

```json
// packages/config/package.json
{
  "name": "@thankscard/config",
  "main": "index.js"
}
```

```json
// packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Apps extend it:
```json
// apps/api/tsconfig.json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

## Root package.json

The root manages dev dependencies shared across all packages and defines convenience scripts:

```json
{
  "name": "thanks-card",
  "private": true,
  "scripts": {
    "dev": "sst dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "typescript": "^5.5.0"
  }
}
```

## Essential pnpm Commands

### Workspace operations

```bash
# Install all dependencies (all packages)
pnpm install

# Add dependency to a specific package
pnpm add zod --filter @thankscard/shared
pnpm add -D vitest --filter @thankscard/api

# Add dependency to root (dev tools shared across all packages)
pnpm add -D prettier -w

# Run script in a specific package
pnpm --filter @thankscard/api dev
pnpm --filter @thankscard/web build

# Run script in all packages (recursive)
pnpm -r build
pnpm -r typecheck
pnpm -r test

# Run script in all packages in parallel
pnpm -r --parallel dev

# Run script only in packages that changed since main
pnpm -r --filter '...[main]' test
```

### Filter syntax

```bash
# By package name
--filter @thankscard/api

# By directory
--filter ./apps/web

# Package and its dependencies
--filter @thankscard/api...

# Package and its dependents (reverse)
--filter ...@thankscard/shared

# All packages that depend on shared
--filter '...{packages/shared}'
```

### Dependency management

```bash
# Check for outdated dependencies
pnpm outdated -r

# Update dependencies
pnpm update -r

# Why is a package installed?
pnpm why <package-name>

# List workspace packages
pnpm ls -r --depth 0

# Clean all node_modules
pnpm -r exec rm -rf node_modules && rm -rf node_modules
```

## TypeScript Project References

For IDE performance in large monorepos, use TypeScript project references:

```json
// Root tsconfig.json
{
  "files": [],
  "references": [
    { "path": "apps/web" },
    { "path": "apps/api" },
    { "path": "packages/shared" },
    { "path": "packages/db" }
  ]
}
```

This enables incremental builds and proper cross-package navigation in editors.

## Common Mistakes

1. **Installing to wrong package** — Always use `--filter` to target the right package. `pnpm add zod` at root installs to root, not to where you probably want it.
2. **Forgetting `workspace:*`** — Using a version number instead of `workspace:*` fetches from npm registry instead of using the local package.
3. **Circular dependencies** — `packages/shared` depends on nothing else. `packages/db` depends on `shared`. `apps/*` depend on `packages/*`. Never reverse this flow.
4. **Running `npm` or `yarn`** — This project uses pnpm exclusively. npm/yarn will ignore the workspace protocol and create incorrect lockfiles.
5. **Missing re-exports in index.ts** — If you add a new schema in `packages/shared/src/schemas/`, export it from `index.ts` or consumers can't import it.
6. **Root vs package dev dependencies** — Shared tools (prettier, typescript) go in root. Package-specific tools (vitest, @vue/test-utils) go in that package.
