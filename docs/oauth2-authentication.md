# OAuth2 Bearer Authentication Guide

## Overview

The `RiaoOAuth2BearerAuthenticationScheme` provides OAuth2 bearer token authentication for REST APIs. It integrates with the `api-machine` server framework to secure endpoints with token verification and principal resolution.

## Installation

```bash
npm install @riao/rest api-machine
```

## Configuration

### Basic Setup

```typescript
import { RiaoOAuth2BearerAuthenticationScheme } from '@riao/rest';
import { RestServer } from 'api-machine';

// Implement the authenticator interface
const authenticator = {
  async verifyAccessToken(token: string) {
    // Call your OAuth2 provider or token service
    const payload = await yourTokenService.verify(token);
    return payload ? { principal_id: payload.sub } : null;
  },

  async findActivePrincipal({ where }) {
    // Fetch principal from database
    return await db.principals.findOne({ where, active: true });
  },
};

// Create the authentication scheme
const auth = new RiaoOAuth2BearerAuthenticationScheme(authenticator, {
  schemeName: 'OAuth2',
  bearerFormat: 'JWT',
  description: 'OAuth2 Bearer Token Authentication',
});

// Use with RestServer
const server = new RestServer({
  port: 3000,
  authentication: auth,
});
```

### Advanced Configuration

```typescript
interface CustomPrincipal extends AuthenticatedPrincipal {
  email: string;
  roles: string[];
  permissions: string[];
}

const authenticator: RiaoOAuth2TokenAuthenticator<CustomPrincipal> = {
  async verifyAccessToken(token: string) {
    try {
      // Verify JWT signature
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return { principal_id: payload.sub };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  },

  async findActivePrincipal({ where }) {
    // Include role and permission information
    return await db.principals.findOne({
      where: { id: where.id, deleted_at: null },
      include: ['roles', 'permissions'],
    });
  },
};

const auth = new RiaoOAuth2BearerAuthenticationScheme(authenticator);
```

## Endpoint Security

### Require Authentication

```typescript
class SecureEndpoint extends RiaoGetOneEndpoint<Document> {
  // This endpoint requires a valid bearer token
  override authentication = { required: true };
}
```

### Require Authorization

Combine authentication with RBAC:

```typescript
class DeleteDocumentEndpoint extends RiaoDeleteEndpoint<Document> {
  // Requires authentication AND specific permission
  override authorization = { 
    action: 'delete', 
    resource: 'documents' 
  };
}
```

### Opt-Out of Authentication

```typescript
class PublicEndpoint extends RiaoGetListEndpoint<PublicData> {
  // Explicitly allow unauthenticated access
  override authentication = null;
}
```

## Token Verification Flow

1. **Extract Token** - Bearer token from `Authorization: Bearer <token>` header
2. **Verify Token** - Call `verifyAccessToken()` to validate token signature/expiration
3. **Resolve Principal** - Call `findActivePrincipal()` to load user from database
4. **Attach to Request** - Principal attached to `request.principal`
5. **Evaluate Authorization** - If endpoint requires authorization, evaluate against principal
6. **Allow/Deny Request** - Return 200 on success, 401/403 on failure

## Error Handling

The framework returns standard HTTP errors:

- **401 Unauthorized** - Missing/invalid token or unverified principal
- **403 Forbidden** - Principal lacks required permission

```typescript
// Example error responses
{
  "statusCode": 401,
  "error": "UnauthorizedError",
  "message": "An authenticated principal is required"
}

{
  "statusCode": 403,
  "error": "ForbiddenError",
  "message": "Access denied by policy"
}
```

## Security Best Practices

### Token Verification

✅ **DO:**
- Verify token signature using cryptographic keys
- Check token expiration
- Validate token claims match expected format
- Use asymmetric keys for distributed verification

❌ **DON'T:**
- Store tokens in plain text
- Skip expiration checks
- Trust token claims without verification
- Use symmetric keys for public verification

### Principal Lookup

✅ **DO:**
- Always query database for latest principal state
- Check principal active/deleted status
- Include role and permission data for authorization
- Cache with short TTLs if high traffic

❌ **DON'T:**
- Trust all claims from token payload
- Use stale principal state
- Skip permission checks
- Cache indefinitely

### Endpoint Protection

✅ **DO:**
- Require authentication for sensitive operations
- Use authorization for resource-specific access
- Log authentication failures
- Monitor authorization denials

❌ **DON'T:**
- Make sensitive endpoints public
- Rely only on authentication, add authorization
- Silently fail authorization checks
- Expose internal permission names

## Logging

Authorization events are logged with details for security auditing:

```
[AuthZ] Authorization required but no principal found
[AuthZ] Authorization denied for principal user-123
[AuthZ] Authorization evaluated for principal user-123
[AuthZ-API] Authorization evaluation error for principal user-123
```

Monitor these logs to detect:
- Failed authentication attempts
- Authorization policy violations
- System errors in authorization pipeline

## Testing

### Unit Tests

```typescript
describe('OAuth2 Authentication', () => {
  it('verifies valid tokens', async () => {
    const scheme = new RiaoOAuth2BearerAuthenticationScheme(authenticator);
    const result = await scheme.authenticate({
      credentials: validToken,
      request: mockRequest,
    });
    expect(result.id).toBe(principalId);
  });

  it('rejects expired tokens', async () => {
    const scheme = new RiaoOAuth2BearerAuthenticationScheme(authenticator);
    await expectAsync(
      scheme.authenticate({
        credentials: expiredToken,
        request: mockRequest,
      })
    ).toBeRejected();
  });
});
```

### Integration Tests

```typescript
describe('Secure Endpoints', () => {
  it('allows authenticated requests', async () => {
    const response = await request(server)
      .get('/documents')
      .set('Authorization', `Bearer ${validToken}`);
    expect(response.status).toBe(200);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(server).get('/documents');
    expect(response.status).toBe(401);
  });

  it('denies unauthorized actions', async () => {
    const response = await request(server)
      .delete('/documents/123')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.status).toBe(403);
  });
});
```

## Environment Configuration

```bash
# .env
JWT_SECRET=your-secret-key
JWT_ISSUER=https://your-auth-provider.com
JWT_AUDIENCE=your-api

# Token validation timeout
TOKEN_VERIFY_TIMEOUT=5000

# Principal cache TTL
PRINCIPAL_CACHE_TTL=3600
```

## Troubleshooting

### Tokens not being verified

- Verify token format matches expected Bearer token format
- Check JWT secret is correct
- Ensure token is not expired
- Check token payload includes required `sub` claim

### 401 Unauthorized on valid tokens

- Verify `findActivePrincipal` returns a principal
- Check principal `active` status in database
- Ensure database connection is working
- Look for exceptions in logs

### 403 Forbidden on allowed actions

- Verify authorization policy is correct
- Check principal has required role/permission
- Review logs for denial reason
- Test with admin principal to rule out permissions

## Related Documentation

- [api-machine](https://github.com/riao-project/api-machine) - REST API framework
- [riao-authz-rbac](https://github.com/riao-project/riao-authz-rbac) - RBAC authorization
- [JWT.io](https://jwt.io/) - JSON Web Tokens
- [OAuth 2.0 Spec](https://tools.ietf.org/html/rfc6749) - Authorization Framework
