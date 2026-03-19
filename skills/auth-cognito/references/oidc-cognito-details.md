# oidc-client-ts + Cognito Details

Advanced configuration and troubleshooting reference.

## Table of Contents

- [UserManager events](#usermanager-events)
- [Cognito Hosted UI configuration](#cognito-hosted-ui-configuration)
- [Google OAuth IdP setup](#google-oauth-idp-setup)
- [Cognito token types](#cognito-token-types)
- [Admin role management](#admin-role-management)
- [Silent renew flow](#silent-renew-flow)
- [Troubleshooting](#troubleshooting)

## UserManager Events

oidc-client-ts exposes events for reacting to auth state changes:

```typescript
const { events } = userManager

// User loaded (after login or silent renew)
events.addUserLoaded((user: User) => {
  // Update app state with new user/token
})

// User unloaded (after logout or session expiry)
events.addUserUnloaded(() => {
  // Clear app state, redirect to login
})

// Access token about to expire
events.addAccessTokenExpiring(() => {
  // Token will expire soon — silent renew will handle this
  // if automaticSilentRenew is true
})

// Access token has expired
events.addAccessTokenExpired(() => {
  // Token expired and silent renew didn't work
  // Force re-login
})

// Silent renew failed
events.addSilentRenewError((error: Error) => {
  // Refresh token expired or network error
  // Redirect to login
  console.error('Silent renew failed:', error)
})

// User session changed in another tab
events.addUserSessionChanged(() => {
  // Re-fetch user from storage
})

// User signed out (detected via session monitoring)
events.addUserSignedOut(() => {
  // User signed out in another tab/window
})
```

### Cleanup

Remove event listeners when no longer needed:

```typescript
const callback = (user: User) => { /* ... */ }
events.addUserLoaded(callback)
// Later:
events.removeUserLoaded(callback)
```

## Cognito Hosted UI Configuration

### SST v3 setup (in sst.config.ts)

```typescript
const userPool = new sst.aws.CognitoUserPool('Auth', {
  triggers: {
    postConfirmation: {
      handler: 'apps/api/src/handlers/post-confirmation.handler',
      link: [table],
    },
  },
  transform: {
    userPool: {
      autoVerifiedAttributes: ['email'],
      usernameAttributes: ['email'],
      accountRecoverySetting: {
        recoveryMechanisms: [{
          name: 'verified_email',
          priority: 1,
        }],
      },
    },
  },
})

// Client for the SPA
const webClient = userPool.addClient('WebClient', {
  transform: {
    client: {
      supportedIdentityProviders: ['Google'],
      allowedOAuthFlows: ['code'],            // Authorization Code Flow
      allowedOAuthScopes: ['openid', 'email', 'profile'],
      allowedOAuthFlowsUserPoolClient: true,
      callbackUrls: [
        'http://localhost:5173/callback',      // Local dev
        `https://${domain}/callback`,          // Production
      ],
      logoutUrls: [
        'http://localhost:5173/login',
        `https://${domain}/login`,
      ],
      // PKCE settings
      generateSecret: false,  // SPAs cannot safely store client secrets
      explicitAuthFlows: [
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      tokenValidityUnits: {
        accessToken: 'hours',
        idToken: 'hours',
        refreshToken: 'days',
      },
      accessTokenValidity: 1,     // 1 hour
      idTokenValidity: 1,         // 1 hour
      refreshTokenValidity: 30,   // 30 days
    },
  },
})
```

### Cognito domain (for Hosted UI)

```typescript
// Custom domain or Cognito prefix domain
// Configure via AWS Console or Pulumi resource
// The domain is used in the UserManager metadata endpoints
```

## Google OAuth IdP Setup

### Prerequisites

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Set authorized redirect URI to: `https://<cognito-domain>/oauth2/idpresponse`
3. Store client ID and secret as SST secrets

```bash
sst secret set GoogleClientId 123456789.apps.googleusercontent.com
sst secret set GoogleClientSecret GOCSPX-xxxxx
```

### SST configuration

```typescript
const googleClientId = new sst.Secret('GoogleClientId')
const googleClientSecret = new sst.Secret('GoogleClientSecret')

userPool.addIdentityProvider('Google', {
  type: 'google',
  details: {
    clientId: googleClientId.value,
    clientSecret: googleClientSecret.value,
    authorize_scopes: 'openid email profile',
  },
  attributeMapping: {
    email: 'email',
    name: 'name',
    picture: 'picture',
    username: 'sub',
  },
})
```

## Cognito Token Types

Cognito issues three tokens. Understanding their purpose prevents misuse:

| Token | Purpose | Contains | Lifetime | Use in API calls |
|-------|---------|----------|----------|-----------------|
| **ID Token** | Identity claims | name, email, picture, cognito:groups | 1 hour (default) | No — for frontend display only |
| **Access Token** | API authorization | sub, scope, client_id, cognito:groups | 1 hour (default) | Yes — send as Bearer token |
| **Refresh Token** | Renew access/ID tokens | Opaque string | 30 days (default) | No — used by oidc-client-ts internally |

### Which token to send to the API?

Send the **access token**, not the ID token. The access token is designed for API authorization. The ID token is for reading user profile claims on the frontend.

```typescript
// Correct
headers: { Authorization: `Bearer ${user.access_token}` }

// Wrong — ID tokens are not for API authorization
headers: { Authorization: `Bearer ${user.id_token}` }
```

### Accessing claims in tokens

```typescript
// Frontend — ID token claims (via oidc-client-ts)
const user = await userManager.getUser()
user.profile.email        // From ID token
user.profile.name
user.profile.picture
user.profile['cognito:groups']

// Backend — Access token claims (via jose jwtVerify)
const { payload } = await jwtVerify(token, jwks, { issuer })
payload.sub               // User ID
payload['cognito:groups'] // Groups (for admin check)
```

## Admin Role Management

Use Cognito User Pool Groups for role-based access control.

### Creating admin group (one-time setup via AWS CLI)

```bash
aws cognito-idp create-group \
  --user-pool-id <pool-id> \
  --group-name admin \
  --description "Administrator group"

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <pool-id> \
  --username <user-sub-or-email> \
  --group-name admin
```

### Checking admin status

```typescript
// Frontend (useAuth composable)
const isAdmin = computed(() => {
  const groups = currentUser.value?.profile?.['cognito:groups'] as string[] | undefined
  return groups?.includes('admin') ?? false
})

// Backend (Hono middleware)
const isAdmin = (payload['cognito:groups'] as string[] ?? []).includes('admin')

// Route-level guard
app.use('/admin/*', async (c, next) => {
  if (!c.get('isAdmin')) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
```

## Silent Renew Flow

oidc-client-ts handles token renewal automatically when `automaticSilentRenew: true`:

1. Access token is about to expire (default: 60 seconds before expiry)
2. oidc-client-ts opens a hidden iframe to Cognito's authorize endpoint
3. Cognito validates the session cookie and returns a new authorization code
4. oidc-client-ts exchanges the code for new tokens
5. `userLoaded` event fires with the new User object

### If silent renew fails

This happens when:
- Refresh token expired (30 days by default)
- Cognito session was revoked
- Network error

Handle it by redirecting to login:

```typescript
userManager.events.addSilentRenewError(() => {
  userManager.removeUser()
  window.location.href = '/login'
})
```

## Troubleshooting

### "CORS error on token endpoint"

Cognito's token endpoint supports CORS. If you see CORS errors:
- Check that the `redirect_uri` in UserManager matches exactly what's configured in the Cognito client's callback URLs
- Ensure the Cognito domain is configured correctly

### "Invalid grant" on callback

- The authorization code may have been used already (codes are single-use)
- The `code_verifier` (PKCE) may not match — this usually means state was lost between redirect and callback
- Check that `redirect_uri` matches exactly (including trailing slash)

### "Token expired" immediately after login

- Check clock skew between client and server
- Verify that `accessTokenValidity` is set correctly in the Cognito client
- jose's `jwtVerify` has a default clock tolerance of 0 — add `clockTolerance: '5s'` if needed

### Tokens not refreshing

- Verify `automaticSilentRenew: true` is set
- Check that the Cognito client allows `ALLOW_REFRESH_TOKEN_AUTH`
- Silent renew needs an iframe — some browsers block third-party cookies which breaks this flow

### User attributes missing from profile

- Check `attributeMapping` in the Google IdP configuration
- Cognito maps Google claims to standard OIDC claims — make sure the scope includes `profile`
- Some claims require `openid` scope to be present
