---
name: dynamodb-electrodb
description: >-
  DynamoDB single-table design and ElectroDB entity modeling guide.
  Covers entity definitions, composite key design, indexes (PK/SK/GSI), CRUD operations,
  Service and Collections, cursor-based pagination, batch operations, update expressions,
  TypeScript type inference (EntityItem, CreateEntityItem), and where clause filters.
  Use this skill whenever working on DynamoDB table design, ElectroDB entity files,
  database access patterns, queries, mutations, or any backend code that interacts with DynamoDB —
  even if the user just mentions "database", "entity", "table", or "data access".
  Also use when discussing access patterns, key design, or data modeling for NoSQL.
---

# DynamoDB + ElectroDB

## DynamoDB Single-Table Design

Single-table design stores all entity types in one DynamoDB table. Entities are distinguished by PK/SK prefix patterns.

### Core principles

- **Design for access patterns, not entities**: Start from how data will be queried, then design keys around those patterns. Unlike relational databases, you cannot add arbitrary queries after the fact.
- **Use composite keys**: PK and SK are strings composed of multiple attributes (e.g., `USER#<userId>` for PK, `PROFILE` for SK). ElectroDB handles this composition automatically.
- **GSIs extend access patterns**: A Global Secondary Index (GSI) provides an alternative PK/SK combination for queries that the main table's keys don't support.
- **Denormalize intentionally**: Store data redundantly across items when read patterns demand it. Write-time aggregation (updating a counter when an item is created) avoids expensive read-time scans.
- **Avoid scans**: Full table scans are expensive and slow. Every data access should use a Query (PK + optional SK condition) or GetItem (exact PK + SK).

### Key design patterns

| Pattern | PK | SK | Use case |
|---------|-----|-----|----------|
| Entity lookup | `USER#<id>` | `PROFILE` | Single-item get by ID |
| 1:N relationship | `USER#<id>` | `ORDER#<timestamp>#<orderId>` | List items belonging to a parent |
| Time-series | `TIMELINE#<YYYY-MM>` | `<timestamp>#<id>` | Paginate items by time, partitioned by month |
| Aggregation | `USER#<id>` | `STATS#<YYYY-MM>` | Pre-computed rollups, updated atomically |

## ElectroDB Entity Definition

ElectroDB manages composite key generation, type safety, and query building. Each entity maps to a set of items in the DynamoDB table.

### AWS SDK v3 setup

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Entity, Service } from 'electrodb'

const dynamoClient = new DynamoDBClient({})
const client = DynamoDBDocumentClient.from(dynamoClient)
const table = process.env.TABLE_NAME ?? 'my-table'
```

When using SST v3, the table name comes from SST's `Resource` binding:

```typescript
import { Resource } from 'sst'
const table = Resource.MyTable.name
```

### Entity schema

```typescript
const UserEntity = new Entity(
  {
    model: {
      entity: 'user',       // Entity type identifier
      version: '1',         // Schema version
      service: 'thankscard', // Service namespace
    },
    attributes: {
      userId: { type: 'string', required: true },
      email: { type: 'string', required: true },
      displayName: { type: 'string', required: true },
      avatarUrl: { type: 'string' },
      role: {
        type: ['admin', 'member'] as const,
        default: 'member',
      },
      createdAt: {
        type: 'string',
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      // Primary index — no `index` field means it uses the table's main PK/SK
      primary: {
        pk: {
          field: 'pk',               // DynamoDB attribute name
          composite: ['userId'],     // Attributes composing the key
          // ElectroDB generates: "$thankscard#userid_<value>"
        },
        sk: {
          field: 'sk',
          composite: [],             // Empty composite = static SK
          // ElectroDB generates: "$user_1"
        },
      },
      // GSI — must specify `index` matching your DynamoDB GSI name
      byEmail: {
        index: 'gsi1pk-gsi1sk-index',
        pk: {
          field: 'gsi1pk',
          composite: ['email'],
        },
        sk: {
          field: 'gsi1sk',
          composite: [],
        },
      },
    },
  },
  { table, client },
)
```

### Attribute types

| Type | Description | Example |
|------|-------------|---------|
| `'string'` | String value | `{ type: 'string' }` |
| `'number'` | Numeric value | `{ type: 'number' }` |
| `'boolean'` | Boolean value | `{ type: 'boolean' }` |
| `['a', 'b'] as const` | Enum (union of literals) | `{ type: ['active', 'blocked'] as const }` |
| `'set'` | DynamoDB String/Number Set | `{ type: 'set', items: 'string' }` |
| `'list'` | Ordered list | `{ type: 'list', items: { type: 'string' } }` |
| `'map'` | Nested object | `{ type: 'map', properties: { ... } }` |
| `'any'` | Untyped (avoid if possible) | `{ type: 'any' }` |

### Attribute options

```typescript
{
  type: 'string',
  required: true,          // Enforce on create
  readOnly: true,          // Prevent updates after creation
  default: 'value',       // Static default
  default: () => uuid(),  // Dynamic default (function)
  validate: /^[a-z]+$/,   // Regex validation
  validate: (v) => v.length > 0, // Function validation
  get: (v) => v?.toUpperCase(),  // Transform on read
  set: (v) => v?.toLowerCase(),  // Transform on write
  field: 'actual_dynamo_field',  // Map to different DynamoDB attribute name
}
```

### Custom key templates

For full control over key format (overriding ElectroDB's default prefix pattern):

```typescript
indexes: {
  primary: {
    pk: {
      field: 'pk',
      composite: ['userId'],
      template: 'USER#${userId}',  // Custom template
    },
    sk: {
      field: 'sk',
      composite: [],
      template: 'PROFILE',         // Static SK
    },
  },
},
```

This is important when interoperating with items not managed by ElectroDB or when following a specific key naming convention.

## CRUD Operations

### Create (put vs create)

```typescript
// put — upserts (overwrites if exists)
await UserEntity.put({ userId: '123', email: 'a@b.com', displayName: 'A' }).go()

// create — fails if item already exists (uses ConditionExpression)
await UserEntity.create({ userId: '123', email: 'a@b.com', displayName: 'A' }).go()
```

### Read (get vs query)

```typescript
// get — single item by full key
const { data } = await UserEntity.get({ userId: '123' }).go()

// query — multiple items by PK (and optional SK condition)
const { data, cursor } = await UserEntity.query
  .primary({ userId: '123' })
  .go()

// query with SK begins_with
const { data } = await CardEntity.query
  .byUser({ userId: '123' })
  .begins({ createdAt: '2026-03' })  // SK begins_with
  .go()

// query with SK between
const { data } = await CardEntity.query
  .byUser({ userId: '123' })
  .between(
    { createdAt: '2026-03-01' },
    { createdAt: '2026-03-31' },
  )
  .go()

// query descending (newest first)
const { data } = await CardEntity.query
  .timeline({ yearMonth: '2026-03' })
  .go({ order: 'desc' })
```

### Update and Patch

```typescript
// update — sets attributes (creates item if not exists)
await UserEntity.update({ userId: '123' })
  .set({ displayName: 'New Name' })
  .go()

// patch — sets attributes (fails if item doesn't exist)
await UserEntity.patch({ userId: '123' })
  .set({ displayName: 'New Name' })
  .go()

// Atomic operations
await StatsEntity.update({ userId: '123', yearMonth: '2026-03' })
  .add({ totalCards: 1 })               // Atomic increment
  .subtract({ remainingQuota: 1 })       // Atomic decrement
  .append({ recentActions: ['sent'] })   // Append to list
  .delete({ tags: ['old-tag'] })         // Remove from set
  .go()

// Nested map updates with data()
await StatsEntity.update({ userId: '123', yearMonth: '2026-03' })
  .data(({ competencies }, { add }) => {
    add(competencies['integrity'], 1)    // Increment map value
  })
  .go()
```

### Delete

```typescript
await UserEntity.delete({ userId: '123' }).go()
```

### Conditional operations (where clause)

```typescript
const { data } = await CardEntity.query
  .timeline({ yearMonth: '2026-03' })
  .where(({ status, isPublic }, { eq }) =>
    `${eq(status, 'published')} AND ${eq(isPublic, true)}`
  )
  .go()
```

Available operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `begins`, `exists`, `notExists`, `contains`, `between`, `name`, `value`.

## Pagination

ElectroDB uses opaque cursor strings for pagination (wrapping DynamoDB's LastEvaluatedKey).

```typescript
// Manual pagination loop
let allItems = []
let cursor: string | null = null

do {
  const page = await CardEntity.query
    .timeline({ yearMonth: '2026-03' })
    .go({ cursor, limit: 20, order: 'desc' })

  allItems.push(...page.data)
  cursor = page.cursor
} while (cursor !== null)

// Fixed page count
const result = await CardEntity.query
  .timeline({ yearMonth: '2026-03' })
  .go({ pages: 3, limit: 20 })
```

For API responses, return the cursor to the client for cursor-based pagination.

## Service and Collections

A `Service` groups related entities and enables cross-entity queries on shared indexes.

```typescript
const AppService = new Service({
  user: UserEntity,
  card: CardEntity,
  reaction: ReactionEntity,
})

// Collection query — returns data from multiple entities in one request
// Entities sharing the same `collection` name on the same index can be queried together
const { data } = await AppService.collections
  .cardDetails({ cardId: '456' })
  .go()
// data.card: Card[], data.reaction: Reaction[]
```

Collections require entities to share an index with the same `collection` name in their schema.

## TypeScript Type Inference

ElectroDB provides utility types to extract TypeScript types from entity definitions — no need to manually define separate interfaces.

```typescript
import type { EntityItem, CreateEntityItem, UpdateEntityItem } from 'electrodb'

// Inferred read type (all attributes, with defaults applied)
type User = EntityItem<typeof UserEntity>

// Inferred create type (required attributes mandatory, optionals optional)
type NewUser = CreateEntityItem<typeof UserEntity>

// Inferred update type (all attributes optional)
type UserUpdate = UpdateEntityItem<typeof UserEntity>
```

This keeps types in sync with the entity definition automatically. When you add or change an attribute in the entity, the types update accordingly.

## Batch Operations

```typescript
// Batch get (up to 100 items, DynamoDB limit is 100 for BatchGetItem)
const { data, unprocessed } = await UserEntity.get([
  { userId: '001' },
  { userId: '002' },
  { userId: '003' },
]).go()

// Batch put
await UserEntity.put([
  { userId: '004', email: 'x@y.com', displayName: 'X' },
  { userId: '005', email: 'z@w.com', displayName: 'Z' },
]).go()

// Batch delete
await UserEntity.delete([
  { userId: '004' },
  { userId: '005' },
]).go()
```

Handle `unprocessed` items for large batches — DynamoDB may return items it couldn't process due to throughput limits.

## Common Mistakes

1. **Using Scan instead of Query** — Almost always wrong. Design keys so every access pattern uses Query or GetItem. Scan reads the entire table and is expensive.
2. **Forgetting GSI for alternative access patterns** — If you need to query by a different attribute (e.g., by email instead of userId), add a GSI. Don't scan and filter.
3. **Not using `as const` for enum types** — Without `as const`, TypeScript infers `string[]` instead of a union type, losing type narrowing.
4. **AWS SDK v2 imports** — Use `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` (v3), not `aws-sdk/clients/dynamodb` (v2).
5. **Read-time aggregation** — Don't query all items to compute a count or sum at read time. Use write-time aggregation with atomic `add` operations.
6. **Ignoring cursor for pagination** — Always return and accept cursors for list endpoints. Never use `pages: 'all'` in production API handlers.
7. **Confusing `put` with `create`** — `put` silently overwrites existing items. Use `create` when the item must not already exist.

For detailed operation reference, see [references/electrodb-operations.md](references/electrodb-operations.md).
