# OAuth2 Bearer Authentication

`RiaoOAuth2BearerAuthenticationScheme` connects an existing token authenticator to `api-machine`.

## Configuration

```typescript
import {
  ApiAuthorizationService,
  ApiRequest,
  BaseApiEndpoint,
  BaseApiRouter,
  RestServer,
} from 'api-machine';
import {
  RiaoOAuth2BearerAuthenticationScheme,
  RiaoOAuth2TokenAuthenticator,
} from '@riao/rest';

interface Principal {
  id: string;
  login: string;
}

declare const authenticator: RiaoOAuth2TokenAuthenticator<Principal>;
declare const authorizer: ApiAuthorizationService;

class ReportsEndpoint extends BaseApiEndpoint {
  override path = '/reports';
  override authorization = { action: 'read', resource: 'reports' };

  async handle(request: ApiRequest) {
    return { principalId: request.principal?.id };
  }
}

class HealthEndpoint extends BaseApiEndpoint {
  override path = '/health';
  override authentication = null;
  override authorization = null;

  async handle() {
    return { healthy: true };
  }
}

class Router extends BaseApiRouter {
  async routes() {
    return [ReportsEndpoint, HealthEndpoint];
  }
}

class Server extends RestServer {
  override router = Router;

  constructor() {
    super({
      port: 3000,
      requireAuthentication: true,
      authentication: new RiaoOAuth2BearerAuthenticationScheme(authenticator, {
        schemeName: 'OAuth2',
        bearerFormat: 'JWT',
        description: 'Application OAuth2 access token',
      }),
      authorizer,
    });
  }
}

const server = new Server();
```

REST CRUD endpoints inherit the same authentication and authorization behavior. Leave `authentication` undefined to inherit the server or nearest router's scheme, or set it to an actual authentication scheme to override.

Set both `authentication = null` and `authorization = null` for an explicitly public endpoint inside a protected router. Authorization requirements otherwise continue to inherit, even if authentication is disabled.

## Authenticator Contract

- `verifyAccessToken(token)` returns `{ principal_id: string }` for a verified access token, or `null` for invalid or expired credentials.
- `findActivePrincipal({ where: { id } })` returns the active principal or `null` if the principal is absent, inactive, or deleted. Enforcing active status is the authenticator's responsibility.
- Operational failures should reject with an error, rather than being converted to invalid credentials. The adapter propagates errors and never grants access on a failed lookup.

Verify signature, expiry, issuer, audience, and relevant token claims in your authenticator. Use the provider's supported verification library, configure timeouts and key rotation there, and do not trust unverified claims. The adapter does not read JWT environment variables, configure caches, or enforce timeouts.

## Request Flow and Errors

Clients send `Authorization: Bearer <access-token>`.

1. The bearer scheme extracts and validates the credential format.
2. The authenticator verifies the token and resolves an active principal.
3. Authentication attaches the principal to the request.
4. If a route declares an authorization requirement, the authorizer evaluates it for that principal before the endpoint handler runs.

| Condition | HTTP status |
|-----------|-------------|
| Missing/invalid token or unresolved active principal | 401 |
| Authenticated principal denied by policy | 403 |
| Unexpected token-service, principal-service, or policy failure | 500 |
| Successful request | Endpoint's configured status |

Typed framework errors retain their HTTP classification. Unexpected failures return a generic internal error rather than exposing backend details.

The response body carries the error name, message, timestamp, and options; the HTTP status is not duplicated as a `statusCode` field:

```json
{
  "error": "ForbiddenError",
  "message": "Authorization denied",
  "timestamp": "2026-10-10T00:00:00.000Z",
  "options": {}
}
```

## Authorization Logging

Configure the server's `log` option to use your application logger. Authorization events include the principal ID, action/resource, HTTP method/path, and incoming `x-request-id` when present. Event names include `authorization.allowed`, `authorization.denied`, `authorization.missing-principal`, and `authorization.error`.

The incoming request ID is correlation data, not a trusted identity. Generate or validate it in trusted application/proxy middleware if needed. Credentials are not included in authorization events; avoid including credentials in errors or policy metadata. Restrict access to logs and configure appropriate retention.

## Testing and Troubleshooting

Test the production adapter, not only mock authenticator methods:

- Valid token plus active principal returns the principal.
- Invalid/expired tokens do not trigger principal lookup.
- Inactive or missing principals reject authentication.
- Verification and lookup errors propagate and prevent handler execution.
- HTTP tests verify 401, 403, public exceptions, and allowed requests.

For 401 responses, check token verification and active-principal lookup. For 403, check the inherited authorization requirement and assigned permissions. For 500, inspect application logs for service failures. Do not disable authorization to work around a dependency outage.

## Related Documentation

- [api-machine authentication and authorization](https://github.com/StatelessStudio/api-machine/blob/main/docs/authentication.md)
- [RBAC integration](https://github.com/riao-project/riao-authz-rbac)
- [OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749)
