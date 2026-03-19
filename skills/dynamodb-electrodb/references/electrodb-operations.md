# ElectroDB Operations Reference

Detailed reference for ElectroDB query and mutation operations.

## Table of Contents

- [Query operations](#query-operations)
- [Update expressions](#update-expressions)
- [Where clause operators](#where-clause-operators)
- [Go options](#go-options)
- [Transaction operations](#transaction-operations)
- [Error handling](#error-handling)

## Query Operations

### Index query

Every query starts from a named index in the entity definition:

```typescript
// Uses the primary index
const { data, cursor } = await Entity.query.primary({ pk_attr: 'value' }).go()

// Uses a GSI
const { data, cursor } = await Entity.query.byAuthor({ author: 'name' }).go()
```

### SK conditions

Chain these after the index query to refine the sort key range:

```typescript
// begins_with
.begins({ sortKeyAttr: 'prefix' })

// between (inclusive range)
.between(
  { sortKeyAttr: 'start' },
  { sortKeyAttr: 'end' },
)

// gt / gte / lt / lte
.gt({ sortKeyAttr: 'value' })
.gte({ sortKeyAttr: 'value' })
.lt({ sortKeyAttr: 'value' })
.lte({ sortKeyAttr: 'value' })
```

### Chaining queries

```typescript
const { data, cursor } = await CardEntity.query
  .timeline({ yearMonth: '2026-03' })       // PK
  .begins({ createdAt: '2026-03-15' })       // SK condition
  .where(({ status }, { eq }) =>             // Filter expression
    eq(status, 'published')
  )
  .go({
    order: 'desc',                           // ScanIndexForward: false
    limit: 20,                               // MaxItems per page
    cursor: previousCursor,                  // Pagination
  })
```

## Update Expressions

ElectroDB supports all DynamoDB update expression operations through chainable methods on `update()` and `patch()`:

### set — overwrite attributes

```typescript
await Entity.update({ id: '123' })
  .set({
    name: 'New Name',
    status: 'active',
  })
  .go()
```

### add — atomic increment/decrement for numbers, add to sets

```typescript
await Entity.update({ id: '123' })
  .add({
    viewCount: 1,       // Increment by 1
    tags: ['new-tag'],  // Add to string set
  })
  .go()
```

### subtract — atomic decrement

```typescript
await Entity.update({ id: '123' })
  .subtract({ remainingQuota: 1 })
  .go()
```

### append — add items to end of list

```typescript
await Entity.update({ id: '123' })
  .append({
    comments: [{ user: 'alice', text: 'Great!' }],
  })
  .go()
```

### remove — remove attributes entirely

```typescript
await Entity.update({ id: '123' })
  .remove(['temporaryField', 'legacyField'])
  .go()
```

### delete — remove items from set

```typescript
await Entity.update({ id: '123' })
  .delete({ tags: ['old-tag'] })
  .go()
```

### data() — complex nested updates

For updates that need fine-grained control over nested attributes:

```typescript
await Entity.update({ id: '123' })
  .data((attributes, operations) => {
    // Increment a nested map value
    operations.add(attributes.scores['math'], 10)

    // Set a nested field
    operations.set(attributes.metadata['lastUpdated'], new Date().toISOString())

    // Set if attribute doesn't exist yet
    operations.ifNotExists(attributes.viewCount, 0)

    // Remove a nested field
    operations.remove(attributes.metadata['deprecated'])
  })
  .go()
```

### Combining multiple operations

All update methods can be chained in a single call:

```typescript
await Entity.update({ id: '123' })
  .set({ status: 'reviewed' })
  .add({ reviewCount: 1 })
  .append({ reviewHistory: [{ date: '2026-03-16', reviewer: 'bob' }] })
  .delete({ pendingReviewers: ['bob'] })
  .where(({ status }, { eq }) => eq(status, 'pending'))
  .go()
```

## Where Clause Operators

The `where` method adds FilterExpressions (applied after DynamoDB reads items but before returning results — items still consume read capacity).

```typescript
.where((attributes, operations) => {
  // Returns a string expression
  return operations.eq(attributes.status, 'active')
})
```

### Available operators

| Operator | Usage | DynamoDB equivalent |
|----------|-------|-------------------|
| `eq` | `eq(attr, value)` | `attr = :value` |
| `ne` | `ne(attr, value)` | `attr <> :value` |
| `gt` | `gt(attr, value)` | `attr > :value` |
| `gte` | `gte(attr, value)` | `attr >= :value` |
| `lt` | `lt(attr, value)` | `attr < :value` |
| `lte` | `lte(attr, value)` | `attr <= :value` |
| `begins` | `begins(attr, value)` | `begins_with(attr, :value)` |
| `exists` | `exists(attr)` | `attribute_exists(attr)` |
| `notExists` | `notExists(attr)` | `attribute_not_exists(attr)` |
| `contains` | `contains(attr, value)` | `contains(attr, :value)` |
| `between` | `between(attr, v1, v2)` | `attr BETWEEN :v1 AND :v2` |

### Combining conditions

```typescript
.where(({ status, isPublic, createdAt }, { eq, gte }) =>
  `${eq(status, 'published')} AND ${eq(isPublic, true)} AND ${gte(createdAt, '2026-01-01')}`
)
```

## Go Options

The `.go()` method accepts an options object:

```typescript
await Entity.query.primary({ id: '123' }).go({
  // Pagination
  cursor: 'opaque-cursor-string',   // Resume from previous query
  limit: 25,                        // Max items to return
  pages: 3,                         // Max pages to fetch (default: 1)
  // pages: 'all'                   // Fetch all pages (dangerous in production!)

  // Ordering
  order: 'asc' | 'desc',           // Sort direction (default: 'asc')

  // Response format
  raw: true,                        // Return raw DynamoDB response
  includeKeys: true,                // Include PK/SK in response
  originalErr: true,                // Throw original DynamoDB errors

  // Data options
  ignoreOwnership: true,            // Return items not managed by this entity
  table: 'override-table',          // Override table name
  data: 'attributes' | 'raw',       // Response data format
  params: {},                       // Merge with generated DynamoDB params

  // Consistency
  consistent: true,                 // Strongly consistent read (main table only, not GSI)
})
```

## Transaction Operations

ElectroDB supports DynamoDB transactions through the Service:

```typescript
const AppService = new Service({ user: UserEntity, card: CardEntity })

// TransactWrite — all-or-nothing writes
await AppService.transaction.write(({ user, card }) => [
  card.create({
    cardId: '789',
    senderId: '123',
    recipientId: '456',
    message: 'Thanks!',
  }).commit(),
  user.update({ userId: '123' })
    .add({ sentCount: 1 })
    .commit(),
]).go()

// TransactGet — consistent reads across items
const results = await AppService.transaction.get(({ user, card }) => [
  user.get({ userId: '123' }).commit(),
  card.get({ cardId: '789' }).commit(),
]).go()
```

Transactions are limited to 100 items and all items must be in the same AWS region.

## Error Handling

ElectroDB throws specific error types:

```typescript
import { ElectroError } from 'electrodb'

try {
  await Entity.create({ id: '123', name: 'test' }).go()
} catch (error) {
  if (error instanceof ElectroError) {
    // error.code — numeric ElectroDB error code
    // error.message — human-readable description
    // error.isElectroError — true

    switch (error.code) {
      case 4001: // Item already exists (from create)
        // Handle duplicate
        break
      case 4002: // Item not found (from patch/remove)
        // Handle missing
        break
    }
  }
}
```

### Common error codes

| Code | Meaning |
|------|---------|
| 1000 | Invalid attribute value |
| 2000 | Missing required attribute |
| 3001 | Missing composite key attribute |
| 4001 | Item already exists (create condition failed) |
| 4002 | Item does not exist (patch/remove condition failed) |
