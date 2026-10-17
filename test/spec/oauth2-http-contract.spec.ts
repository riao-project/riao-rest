import {
	ApiRequest,
	BaseApiEndpoint,
	BaseApiRouter,
	RestServer,
} from 'api-machine';
import { LogInterface } from 'api-machine/log';
import {
	RiaoOAuth2BearerAuthenticationScheme,
} from '../../src/authentication';

describe('Documented OAuth2 adapter HTTP contract', () => {
	let server: RestServer;
	let url: string;
	let handled: number;
	let verifierFailure: boolean;
	let lookupFailure: boolean;
	let policyFailure: boolean;

	class ReportsEndpoint extends BaseApiEndpoint {
		override path = '/reports';
		override authorization = { action: 'read', resource: 'reports' };
		async handle(request: ApiRequest) {
			handled++;
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
		get url(): string {
			const address = this.listener.address();
			if (!address || typeof address === 'string') {
				throw new Error('Expected TCP listener');
			}
			return `http://127.0.0.1:${address.port}`;
		}
	}

	beforeEach(async () => {
		handled = 0;
		verifierFailure = lookupFailure = policyFailure = false;
		const instance = new Server({
			port: 0, requireAuthentication: true,
			log: jasmine.createSpyObj<LogInterface>(
				'log', ['fatal', 'error', 'warn', 'info', 'debug']
			),
			authentication: new RiaoOAuth2BearerAuthenticationScheme({
				verifyAccessToken: async (token) => {
					if (verifierFailure) {
						throw new Error('Private verifier failure');
					}
					return ['allowed', 'denied', 'inactive'].includes(token)
						? { principal_id: token } : null;
				},
				findActivePrincipal: async ({ where }) => {
					if (lookupFailure) {
						throw new Error('Private lookup failure');
					}
					return !where.id || where.id === 'inactive'
						? null : { id: where.id };
				},
			}),
			authorizer: {
				async evaluate({ principal }) {
					if (policyFailure) {
						throw new Error('Private policy failure');
					}
					return { allowed: principal.id === 'allowed' };
				},
			},
		});
		server = instance;
		await server.start();
		url = instance.url;
	});

	afterEach(async () => {
		await server.stop();
	});

	async function request(token?: string) {
		return fetch(`${url}/reports`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		});
	}

	it('returns the trusted identity on allowed requests', async () => {
		const response = await request('allowed');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ principalId: 'allowed' });
		expect(handled).toBe(1);
	});

	it('rejects invalid or inactive credentials before handlers', async () => {
		for (const token of [undefined, 'invalid', 'inactive']) {
			expect((await request(token)).status).toBe(401);
		}
		expect(handled).toBe(0);
	});

	it('distinguishes policy denial from credential rejection', async () => {
		expect((await request('denied')).status).toBe(403);
		expect(handled).toBe(0);
	});

	it('preserves the explicit public exception', async () => {
		expect((await fetch(`${url}/health`)).status).toBe(200);
	});

	it('maps service failures to generic errors without handler execution',
		async () => {
			for (const failure of ['verifier', 'lookup', 'policy']) {
				verifierFailure = failure === 'verifier';
				lookupFailure = failure === 'lookup';
				policyFailure = failure === 'policy';
				const response = await request('allowed');
				expect(response.status).toBe(500);
				expect(await response.text()).not.toContain('Private');
			}
			expect(handled).toBe(0);
		});
});
