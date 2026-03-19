# Test Patterns Reference

## Table of Contents

- [File naming and location](#file-naming-and-location)
- [Test naming conventions](#test-naming-conventions)
- [Arrange-Act-Assert pattern](#arrange-act-assert-pattern)
- [Testing async code](#testing-async-code)
- [Snapshot testing](#snapshot-testing)
- [Test fixtures and factories](#test-fixtures-and-factories)
- [Playwright authentication](#playwright-authentication)
- [CI configuration](#ci-configuration)

## File Naming and Location

### Unit / Integration tests (Vitest)

Co-locate test files with the source they test:

```
apps/api/src/
├── services/
│   ├── competency.ts
│   └── competency.test.ts       ← Unit test
├── routes/
│   ├── cards.ts
│   └── cards.test.ts            ← Integration test (testClient)
└── lib/
    ├── streak.ts
    └── streak.test.ts           ← Unit test
```

### E2E tests (Playwright)

Separate directory at project root, organized by user flow:

```
e2e/
├── auth.spec.ts                 ← Login / logout flows
├── card-sending.spec.ts         ← Card creation flow
├── timeline.spec.ts             ← Timeline browsing
├── my-page.spec.ts              ← My page features
└── fixtures/
    └── test-data.ts             ← Shared test data
```

## Test Naming Conventions

Use descriptive names that read like specifications:

```typescript
// Good — describes behavior
describe('calculateBadgeLevel', () => {
  it('returns "bronze" when count is between 1 and 9', () => {})
  it('returns "silver" when count reaches 10', () => {})
  it('returns "gold" when count reaches 50', () => {})
  it('returns null when count is 0', () => {})
})

// Good — describes user-facing behavior for E2E
test('user sees error message when sending card without recipient', async () => {})
test('timeline shows newest cards first', async () => {})

// Bad — describes implementation
it('calls calculateBadge with correct arguments', () => {})
it('sets state.badge to silver', () => {})
```

## Arrange-Act-Assert Pattern

Structure each test in three clear phases:

```typescript
it('blocks card with prohibited content', async () => {
  // Arrange — set up test data and dependencies
  const card = createTestCard({ message: 'prohibited content here' })
  const filter = new ContentFilter(mockBedrockClient)

  // Act — execute the behavior under test
  const result = await filter.check(card.message)

  // Assert — verify the outcome
  expect(result.blocked).toBe(true)
  expect(result.reason).toContain('content policy')
})
```

## Testing Async Code

### Promises

```typescript
it('fetches user by ID', async () => {
  const user = await UserService.getById('123')
  expect(user).toEqual(expect.objectContaining({ userId: '123' }))
})

// Test rejection
it('throws for non-existent user', async () => {
  await expect(UserService.getById('nonexistent')).rejects.toThrow('not found')
})
```

### Timers

```typescript
import { vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('debounces search input', async () => {
  const search = vi.fn()
  const debouncedSearch = debounce(search, 300)

  debouncedSearch('hello')
  expect(search).not.toHaveBeenCalled()

  vi.advanceTimersByTime(300)
  expect(search).toHaveBeenCalledWith('hello')
})
```

## Snapshot Testing

Use sparingly — best for stable output like serialized data or error messages:

```typescript
it('formats card for timeline display', () => {
  const formatted = formatCardForTimeline(testCard)
  expect(formatted).toMatchInlineSnapshot(`
    {
      "id": "card-123",
      "sender": "Alice",
      "message": "Thanks!",
      "competencies": ["integrity"],
      "timeAgo": "2 hours ago",
    }
  `)
})
```

Avoid snapshots for:
- Large objects (hard to review changes)
- HTML/DOM output (too fragile)
- Anything that changes frequently

## Test Fixtures and Factories

Create factory functions instead of shared fixture objects:

```typescript
// test/factories.ts
import { faker } from '@faker-js/faker'

export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    userId: faker.string.uuid(),
    email: faker.internet.email(),
    displayName: faker.person.fullName(),
    avatarUrl: faker.image.avatar(),
    role: 'member',
    ...overrides,
  }
}

export function createTestCard(overrides: Partial<Card> = {}): Card {
  return {
    cardId: faker.string.uuid(),
    senderId: faker.string.uuid(),
    recipientIds: [faker.string.uuid()],
    message: faker.lorem.sentence(),
    isPublic: true,
    status: 'published',
    competencies: [],
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  }
}
```

Usage:
```typescript
it('filters blocked cards from timeline', () => {
  const cards = [
    createTestCard({ status: 'published' }),
    createTestCard({ status: 'blocked' }),
    createTestCard({ status: 'published' }),
  ]
  const visible = cards.filter(c => c.status === 'published')
  expect(visible).toHaveLength(2)
})
```

## Playwright Authentication

### Storage state pattern

Save and reuse auth state to avoid logging in for every test:

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  // Perform login flow
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  // ... handle OAuth flow ...
  await expect(page).toHaveURL('/timeline')

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/state.json' })
})
```

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'tests',
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/state.json',
      },
    },
  ],
})
```

## CI Configuration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
```

### Package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```
