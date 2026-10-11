import 'jasmine';
import {
	ApiRequest,
	AuthenticatedPrincipal,
	UnauthorizedError,
} from 'api-machine';
import {
	RiaoOAuth2BearerAuthenticationScheme,
	RiaoOAuth2TokenAuthenticator,
} from '../../src/authentication';

interface TestPrincipal extends AuthenticatedPrincipal {
	login: string;
	active: boolean;
}

describe('RiaoOAuth2BearerAuthenticationScheme Security', () => {
	let principal: TestPrincipal;
	let inactivePrincipal: TestPrincipal;
	let authenticator: RiaoOAuth2TokenAuthenticator<TestPrincipal>;
	let scheme: RiaoOAuth2BearerAuthenticationScheme<TestPrincipal>;
	let request: ApiRequest;

	beforeEach(() => {
		principal = {
			id: 'principal-1',
			login: 'test-user',
			active: true,
		};
		inactivePrincipal = {
			id: 'principal-2',
			login: 'inactive-user',
			active: false,
		};
		authenticator = {
			verifyAccessToken: async (token) =>
				token === 'valid-token'
					? { principal_id: principal.id }
					: null,
			findActivePrincipal: async ({ where }) => {
				if (where.id === principal.id && principal.active) {
					return principal;
				}
				if (
					where.id === inactivePrincipal.id &&
					inactivePrincipal.active
				) {
					return inactivePrincipal;
				}
				return null;
			},
		};
		scheme = new RiaoOAuth2BearerAuthenticationScheme(authenticator);
		request = { headers: {}, ip: '127.0.0.1' } as ApiRequest;
	});

	it('rejects tokens for inactive principals', async () => {
		authenticator.verifyAccessToken = async () => ({
			principal_id: inactivePrincipal.id,
		});

		await expectAsync(scheme.authenticate({
			credentials: 'Bearer valid-token', request,
		})).toBeRejectedWithError(UnauthorizedError);
	});

	it('resolves tokens for active principals', async () => {
		const result = await scheme.authenticate({
			credentials: 'Bearer valid-token', request,
		});
		expect(result).toEqual(principal);
	});

	it('rejects tokens when principal lookup fails', async () => {
		authenticator.verifyAccessToken = async () => ({
			principal_id: 'nonexistent-principal',
		});

		await expectAsync(scheme.authenticate({
			credentials: 'Bearer valid-token', request,
		})).toBeRejectedWithError(UnauthorizedError);
	});

	it('rejects invalid tokens before principal lookup', async () => {
		const lookup = spyOn(authenticator, 'findActivePrincipal');
		await expectAsync(scheme.authenticate({
			credentials: 'Bearer expired.token.here', request,
		})).toBeRejectedWithError(UnauthorizedError);
		expect(lookup).not.toHaveBeenCalled();
	});

	it('propagates token verification errors', async () => {
		const error = new Error('Token verification service unavailable');
		spyOn(authenticator, 'verifyAccessToken').and.rejectWith(error);

		await expectAsync(scheme.authenticate({
			credentials: 'Bearer valid-token', request,
		})).toBeRejectedWith(error);
	});

	it('propagates principal lookup errors', async () => {
		const error = new Error('Principal service unavailable');
		spyOn(authenticator, 'findActivePrincipal').and.rejectWith(error);
		await expectAsync(scheme.authenticate({
			credentials: 'Bearer valid-token', request,
		})).toBeRejectedWith(error);
	});
});
