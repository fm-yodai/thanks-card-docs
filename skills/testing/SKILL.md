---
name: testing
description: >-
  Vitest (unit/integration) + Playwright (E2E) testing guide for Vue 3 + Hono applications.
  Covers test structure, assertions, mocking with vi.fn/vi.spyOn/vi.mock, Hono testClient
  for API integration tests, Playwright page objects, locators, and E2E patterns.
  Use this skill whenever writing tests, fixing failing tests, adding test coverage,
  setting up test configuration, or any task involving test files (.test.ts, .spec.ts) —
  even if the user just mentions "test", "spec", "coverage", "assert", or "mock".
  Also use when the user asks to verify behavior, add regression tests, or test an endpoint.
---

# Testing: Vitest + Playwright

## Test Strategy Overview

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit | Vitest | Pure functions, composables, business logic | Co-located with source (`*.test.ts`) |
| Integration | Vitest + Hono testClient | API endpoints, middleware chains | `apps/api/src/**/*.test.ts` |
| E2E | Playwright | Full user flows through the browser | `e2e/` at project root |

## Vitest

### Configuration

```typescript
// vitest.config.ts (or in vite.config.ts)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,                    // No need to import describe/test/expect
    environment: 'node',             // 'jsdom' for Vue component tests
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
    clearMocks: true,                // Auto-clear mock state between tests
    restoreMocks: true,              // Auto-restore original implementations
  },
})
```

### Test structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('calculateStreak', () => {
  it('returns 1 for first card sent today', () => {
    const result = calculateStreak([], new Date('2026-03-16'))
    expect(result).toBe(1)
  })

  it('increments streak for consecutive days', () => {
    const history = [
      { sentAt: '2026-03-14' },
      { sentAt: '2026-03-15' },
    ]
    const result = calculateStreak(history, new Date('2026-03-16'))
    expect(result).toBe(3)
  })

  it('resets streak when a day is skipped', () => {
    const history = [{ sentAt: '2026-03-13' }]
    const result = calculateStreak(history, new Date('2026-03-16'))
    expect(result).toBe(1)
  })
})
```

### Common assertions

```typescript
// Equality
expect(value).toBe(42)               // Strict equality (===)
expect(obj).toEqual({ a: 1 })        // Deep equality
expect(obj).toStrictEqual({ a: 1 })  // Deep + type equality

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeLessThanOrEqual(10)
expect(value).toBeCloseTo(0.3, 5)

// Strings
expect(str).toMatch(/pattern/)
expect(str).toContain('substring')

// Arrays / Objects
expect(arr).toContain(item)
expect(arr).toHaveLength(3)
expect(obj).toHaveProperty('key', 'value')

// Exceptions
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('error message')
expect(() => fn()).toThrowError(/pattern/)

// Async
await expect(promise).resolves.toBe(42)
await expect(promise).rejects.toThrow('fail')
```

### Mocking

```typescript
// Mock function
const mockFn = vi.fn()
mockFn.mockReturnValue(42)
mockFn.mockResolvedValue({ data: [] })    // For async
mockFn.mockImplementation((x) => x * 2)

// Assertions on mock calls
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledTimes(2)
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')

// Spy on existing method
const spy = vi.spyOn(service, 'sendEmail')
spy.mockResolvedValue({ messageId: '123' })
// ... call code that uses service.sendEmail ...
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com' }))

// Mock module
vi.mock('@/lib/bedrock', () => ({
  classifyCompetency: vi.fn().mockResolvedValue('integrity'),
}))

// Mock date/time
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-03-16T09:00:00'))
// ... run tests with fixed time ...
vi.useRealTimers()
```

### Testing Vue composables

```typescript
// Test a composable that uses ref/computed
import { useToggle } from '@/composables/useToggle'

describe('useToggle', () => {
  it('starts with initial value', () => {
    const { value } = useToggle(false)
    expect(value.value).toBe(false)
  })

  it('toggles value', () => {
    const { value, toggle } = useToggle(false)
    toggle()
    expect(value.value).toBe(true)
  })
})
```

For composables that depend on Vue lifecycle or provide/inject, wrap in a test component or use `@vue/test-utils`.

## Hono Integration Tests (testClient)

Test API endpoints directly without starting a server. Hono's `testClient` provides type-safe request building.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testClient } from 'hono/testing'
import { app } from '@/app'  // Your Hono app instance

describe('POST /cards', () => {
  it('creates a card and returns 201', async () => {
    const client = testClient(app)

    const res = await client.cards.$post({
      json: {
        recipientIds: ['user-456'],
        message: 'Thanks for the help!',
        isPublic: true,
      },
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('cardId')
    expect(body.status).toBe('processing')
  })

  it('returns 422 for invalid input', async () => {
    const client = testClient(app)

    const res = await client.cards.$post({
      json: {
        recipientIds: [],  // Empty — should fail Zod validation
        message: '',
      },
    })

    expect(res.status).toBe(422)
  })
})
```

### Mocking middleware for integration tests

When testing routes that require authentication:

```typescript
// Mock the JWT auth middleware to inject a test user
vi.mock('@/middleware/auth', () => ({
  jwtAuth: () => async (c, next) => {
    c.set('userId', 'test-user-123')
    c.set('userEmail', 'test@example.com')
    c.set('isAdmin', false)
    await next()
  },
}))
```

## Playwright E2E Tests

### Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,      // No .only in CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',         // Capture trace on failure
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Test structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Card sending flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: login and navigate
    await page.goto('/timeline')
  })

  test('user can send a thanks card', async ({ page }) => {
    await page.getByRole('link', { name: 'New Card' }).click()
    await expect(page).toHaveURL('/cards/new')

    // Fill form
    await page.getByLabel('Recipient').click()
    await page.getByRole('option', { name: 'Tanaka' }).click()
    await page.getByLabel('Message').fill('Thanks for reviewing my PR!')
    await page.getByRole('button', { name: 'Send' }).click()

    // Verify success
    await expect(page.getByText('Card sent')).toBeVisible()
  })
})
```

### Locator best practices

Prefer accessible locators over CSS selectors. This makes tests resilient to DOM changes and aligns with a11y best practices:

```typescript
// Preferred — role-based (most resilient)
page.getByRole('button', { name: 'Send' })
page.getByRole('heading', { name: 'Timeline' })
page.getByRole('link', { name: 'My Page' })

// Preferred — label-based (forms)
page.getByLabel('Message')
page.getByPlaceholder('Search...')

// Preferred — text-based
page.getByText('Card sent successfully')

// Preferred — test ID (when no semantic locator fits)
page.getByTestId('card-list')

// Avoid — fragile CSS selectors
page.locator('.btn-primary')        // Breaks on class rename
page.locator('#submit-btn')         // Breaks on ID change
page.locator('div > span:nth-child(2)')  // Breaks on DOM restructure
```

### Playwright assertions

```typescript
// Element state
await expect(locator).toBeVisible()
await expect(locator).toBeHidden()
await expect(locator).toBeEnabled()
await expect(locator).toBeDisabled()

// Text content
await expect(locator).toHaveText('exact text')
await expect(locator).toContainText('partial')
await expect(locator).toHaveValue('input value')

// Page
await expect(page).toHaveURL('/timeline')
await expect(page).toHaveTitle('Thanks Card')

// Count
await expect(page.getByRole('listitem')).toHaveCount(5)
```

## Common Mistakes

1. **Testing implementation details** — Test behavior (inputs → outputs), not internal state or method calls. Refactoring should not break tests.
2. **Over-mocking** — Mock external boundaries (APIs, DB, third-party services), not internal modules. Over-mocking creates tests that pass even when the real code is broken.
3. **Using CSS selectors in Playwright** — Use role/label/text locators. CSS selectors break on refactoring.
4. **Not awaiting Playwright assertions** — All `expect()` calls in Playwright are async. Missing `await` causes flaky tests.
5. **Sharing state between tests** — Each test should set up its own state. Use `beforeEach`, not shared variables mutated across tests.
6. **Forgetting `clearMocks: true`** — Without it, mock call counts leak between tests, causing false failures.

For test file naming and organization patterns, see [references/test-patterns.md](references/test-patterns.md).
