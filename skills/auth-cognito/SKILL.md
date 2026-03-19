---
name: auth-cognito
description: >-
  AWS Cognito + Google OAuth + oidc-client-ts authentication guide.
  Covers Cognito User Pool setup, Google OAuth Identity Provider, Authorization Code Flow
  with PKCE, oidc-client-ts UserManager configuration, JWT verification on the backend
  (jose library), Vue composable for auth state (useAuth), navigation guards,
  and Cognito Lambda triggers (PostConfirmation for user provisioning).
  Use this skill whenever working on authentication, login, logout, session management,
  JWT tokens, OAuth, OIDC, Cognito configuration, auth middleware, protected routes,
  or user identity — even if the user just mentions "login", "auth", "token", or "session".
---

# Cognito + Google OAuth + oidc-client-ts

## Architecture Overview

```
Browser (Vue SPA)                    AWS
┌──────────────────┐     ┌──────────────────────────┐
│  oidc-client-ts  │────▶│  Cognito Hosted UI       │
│  (PKCE flow)     │◀────│  + Google OAuth IdP       │
│                  │     │                          │
│  useAuth         │     │  Post-Confirmation       │
│  composable      │     │  Lambda Trigger           │
│                  │     │  → DynamoDB UserProfile   │
│  JWT in memory   │     │                          │
│  (not localStorage)    └──────────────────────────┘
│                  │
│  Authorization   │     ┌──────────────────────────┐
│  header          │────▶│  Hono API (Lambda)       │
│                  │     │  jwtAuth middleware       │
│                  │     │  (jose JWKS verification) │
└──────────────────┘     └──────────────────────────┘
```

### Why oidc-client-ts (not Amplify)

- **IdP-agnostic**: Switching from Cognito to Auth0 or Keycloak requires only config changes, no code changes. This matters for multi-tenant / white-label scenarios.
- **No vendor lock-in**: Amplify bundles Cognito-specific logic deeply. oidc-client-ts speaks standard OIDC.
- **Smaller bundle**: oidc-client-ts is ~15KB gzipped vs Amplify Auth ~50KB+.

## Frontend: oidc-client-ts

### UserManager configuration

```typescript
// auth/config.ts
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

export const userManager = new UserManager({
  authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id: cognitoClientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/login`,
  response_type: 'code',           // Authorization Code Flow
  scope: 'openid email profile',
  automaticSilentRenew: true,      // Auto-refresh tokens before expiry
  // Store tokens in sessionStorage (cleared on tab close)
  // NOT localStorage (persists across tabs, XSS risk)
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),

  // Cognito-specific metadata overrides
  // (needed because Cognito's OIDC discovery has quirks)
  metadata: {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    authorization_endpoint: `https://${cognitoDomain}/oauth2/authorize`,
    token_endpoint: `https://${cognitoDomain}/oauth2/token`,
    userinfo_endpoint: `https://${cognitoDomain}/oauth2/userInfo`,
    end_session_endpoint: `https://${cognitoDomain}/logout`,
  },
})
```

### Auth flow methods

```typescript
// Redirect to Cognito Hosted UI (Google OAuth)
await userManager.signinRedirect()

// Handle callback after redirect back (on /callback route)
const user = await userManager.signinRedirectCallback()

// Get current user (null if not authenticated)
const user = await userManager.getUser()

// Access token for API calls
const token = user?.access_token

// ID token claims (name, email, picture from Google)
const claims = user?.profile
// claims.email, claims.name, claims.picture

// Logout
await userManager.signoutRedirect()

// Silent token renewal (happens automatically if automaticSilentRenew: true)
await userManager.signinSilent()
```

### Vue composable: useAuth

```typescript
// composables/useAuth.ts
import { ref, computed, readonly } from 'vue'
import type { User } from 'oidc-client-ts'
import { userManager } from '@/auth/config'

const currentUser = ref<User | null>(null)
const isLoading = ref(true)

export function useAuth() {
  const isAuthenticated = computed(() => !!currentUser.value && !currentUser.value.expired)
  const accessToken = computed(() => currentUser.value?.access_token ?? null)
  const profile = computed(() => currentUser.value?.profile ?? null)

  // Check if user has admin role (from Cognito custom attribute or group)
  const isAdmin = computed(() => {
    const groups = currentUser.value?.profile?.['cognito:groups'] as string[] | undefined
    return groups?.includes('admin') ?? false
  })

  async function initialize() {
    try {
      isLoading.value = true
      currentUser.value = await userManager.getUser()
    } finally {
      isLoading.value = false
    }
  }

  async function login() {
    await userManager.signinRedirect()
  }

  async function handleCallback(): Promise<User> {
    const user = await userManager.signinRedirectCallback()
    currentUser.value = user
    return user
  }

  async function logout() {
    await userManager.signoutRedirect()
    currentUser.value = null
  }

  // Listen for token events
  userManager.events.addUserLoaded((user) => {
    currentUser.value = user
  })
  userManager.events.addUserUnloaded(() => {
    currentUser.value = null
  })
  userManager.events.addSilentRenewError(() => {
    // Token refresh failed — force re-login
    currentUser.value = null
  })

  return {
    currentUser: readonly(currentUser),
    isAuthenticated,
    isLoading: readonly(isLoading),
    isAdmin,
    accessToken,
    profile,
    initialize,
    login,
    handleCallback,
    logout,
  }
}
```

### Navigation guard

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/callback', component: CallbackPage, meta: { public: true } },
    { path: '/timeline', component: TimelinePage },
    { path: '/cards/new', component: CardNewPage },
    { path: '/my', component: MyPage },
  ],
})

router.beforeEach(async (to) => {
  const { isAuthenticated, isLoading, initialize } = useAuth()

  // Initialize auth state on first navigation
  if (isLoading.value) {
    await initialize()
  }

  // Public routes don't need auth
  if (to.meta.public) {
    // Redirect authenticated users away from login
    if (to.path === '/login' && isAuthenticated.value) {
      return '/timeline'
    }
    return true
  }

  // Protected routes require auth
  if (!isAuthenticated.value) {
    return '/login'
  }

  return true
})
```

### API client with auth header

```typescript
// api/client.ts
import { hc } from 'hono/client'
import type { AppType } from '@thankscard/api'
import { useAuth } from '@/composables/useAuth'

export function createApiClient() {
  const { accessToken } = useAuth()

  return hc<AppType>(import.meta.env.VITE_API_URL, {
    headers: () => ({
      Authorization: accessToken.value ? `Bearer ${accessToken.value}` : '',
    }),
  })
}
```

## Backend: JWT Verification

### Hono middleware with jose

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Context } from 'hono'

const JWKS_URI = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
const ISSUER = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`

// Cache JWKS (jose handles caching internally)
const jwks = createRemoteJWKSet(new URL(JWKS_URI))

interface AuthPayload {
  sub: string
  email: string
  'cognito:groups'?: string[]
  'cognito:username': string
}

export const jwtAuth = () =>
  createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: ISSUER,
        // Cognito access tokens use client_id, not audience
      })

      // Attach user info to context
      c.set('userId', payload.sub as string)
      c.set('userEmail', payload.email as string)
      c.set('isAdmin', (payload['cognito:groups'] as string[] ?? []).includes('admin'))
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    await next()
  })
```

### Using auth context in routes

```typescript
// routes/cards.ts
app.post('/cards', zValidator('json', createCardSchema), async (c) => {
  const userId = c.get('userId')   // Set by jwtAuth middleware
  const body = c.req.valid('json')
  // ...
})
```

## Cognito Lambda Triggers

### PostConfirmation: Auto-create user profile

Triggered on first successful login. Creates a DynamoDB UserProfile from Google OAuth claims.

```typescript
// handlers/post-confirmation.ts
import type { PostConfirmationTriggerEvent } from 'aws-lambda'
import { UserEntity } from '@thankscard/db'

export async function handler(event: PostConfirmationTriggerEvent) {
  // Only run on first sign-up confirmation
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event
  }

  const { sub, email, name, picture } = event.request.userAttributes

  await UserEntity.create({
    userId: sub,
    email,
    displayName: name ?? email.split('@')[0],
    avatarUrl: picture ?? '',
    role: 'member',
  }).go()

  return event
}
```

### Important: Always return the event object from Cognito triggers. Forgetting this blocks the auth flow silently.

## Token Storage Security

| Storage | Pros | Cons | Verdict |
|---------|------|------|---------|
| `sessionStorage` | Cleared on tab close, per-tab isolation | Lost on refresh (re-auth needed) | Recommended for SPAs |
| `localStorage` | Persists across tabs/refreshes | XSS can steal tokens, shared across tabs | Avoid for tokens |
| In-memory (JS variable) | Most secure, no persistence | Lost on any navigation/refresh | Good for short-lived apps |
| HttpOnly cookie | Immune to XSS | Requires backend cookie management, CSRF risk | Better for SSR |

This project uses `sessionStorage` via oidc-client-ts's `WebStorageStateStore`. The `automaticSilentRenew` option handles token refresh transparently using an iframe-based silent renew flow.

## Common Mistakes

1. **Using Amplify patterns** — This project uses oidc-client-ts, not Amplify. Do not import from `aws-amplify` or `@aws-amplify/auth`.
2. **Storing tokens in localStorage** — Use `sessionStorage` or in-memory. localStorage is accessible to any script on the page (XSS risk).
3. **Verifying JWTs on the frontend** — JWT verification happens on the backend only. The frontend just attaches the token to requests.
4. **Forgetting `return event` in Cognito triggers** — Lambda triggers must return the event object. Omitting this silently breaks the auth flow.
5. **Using Cognito Admin SDK from the frontend** — All Cognito admin operations go through the backend. The frontend only uses oidc-client-ts for the OIDC flow.
6. **Hardcoding Cognito URLs** — Construct URLs from `region` and `userPoolId`. Use environment variables, not hardcoded strings.
7. **Not handling `silentRenewError`** — When silent renew fails (e.g., refresh token expired), redirect to login. Otherwise users see cryptic 401 errors.

For detailed oidc-client-ts events and advanced Cognito configuration, see [references/oidc-cognito-details.md](references/oidc-cognito-details.md).
