import 'jasmine';
import { AuthenticatedPrincipal, ApiRequest } from 'api-machine';
import {
	RiaoOAuth2BearerAuthenticationScheme,
	RiaoOAuth2TokenAuthenticator,
} from '../../src/authentication';

interface TestPrincipal extends AuthenticatedPrincipal {
	login: string;
}

describe('RiaoOAuth2BearerAuthenticationScheme', () => {
	let principal: TestPrincipal;
	let authenticator: RiaoOAuth2TokenAuthenticator<TestPrincipal>;

	beforeEach(() => {
		principal = { id: 'principal-1', login: 'test-user' };
		authenticator = {
			verifyAccessToken: async (token) =>
				token === 'valid-token'
					? { principal_id: principal.id }
					: null,
			findActivePrincipal: async ({ where }) =>
				where.id === principal.id ? principal : null,
		};
	});

	it('returns the resolved principal for a valid access token', async () => {
		const scheme = new RiaoOAuth2BearerAuthenticationScheme(authenticator);
		const result = await scheme.authenticate({
			credentials: 'Bearer valid-token',
			request: { ip: '127.0.0.1' } as ApiRequest,
		});

		expect(result).toEqual(principal);
	});

	it('rejects invalid tokens without resolving a principal', async () => {
		const findPrincipal = spyOn(
			authenticator,
			'findActivePrincipal'
		).and.callThrough();
		const scheme = new RiaoOAuth2BearerAuthenticationScheme(authenticator);

		await expectAsync(
			scheme.authenticate({
				credentials: 'Bearer invalid-token',
				request: { ip: '127.0.0.1' } as ApiRequest,
			})
		).toBeRejected();
		expect(findPrincipal).not.toHaveBeenCalled();
	});
});