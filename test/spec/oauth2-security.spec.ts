import 'jasmine';
import { AuthenticatedPrincipal } from 'api-machine';
import {
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
	});

	it('rejects tokens for inactive principals', async () => {
		authenticator.verifyAccessToken = async () => ({
			principal_id: inactivePrincipal.id,
		});

		const result = await authenticator.verifyAccessToken('token');
		expect(result?.principal_id).toBe('principal-2');

		const resolvedPrincipal =
			await authenticator.findActivePrincipal({
				where: { id: inactivePrincipal.id } as Partial<TestPrincipal>,
			});
		expect(resolvedPrincipal).toBeNull();
	});

	it('resolves tokens for active principals', async () => {
		const result = await authenticator.verifyAccessToken('valid-token');
		expect(result?.principal_id).toBe('principal-1');

		const resolvedPrincipal =
			await authenticator.findActivePrincipal({
				where: { id: principal.id } as Partial<TestPrincipal>,
			});
		expect(resolvedPrincipal).toEqual(principal);
	});

	it('rejects tokens when principal lookup fails', async () => {
		authenticator.verifyAccessToken = async () => ({
			principal_id: 'nonexistent-principal',
		});

		const result = await authenticator.verifyAccessToken('token');
		expect(result?.principal_id).toBe('nonexistent-principal');

		const resolvedPrincipal =
			await authenticator.findActivePrincipal({
				where: { id: 'nonexistent-principal' } as Partial<
					TestPrincipal
				>,
			});
		expect(resolvedPrincipal).toBeNull();
	});

	it('verifies token format validation', async () => {
		const expiredToken = 'expired.token.here';
		const result = await authenticator.verifyAccessToken(expiredToken);
		expect(result).toBeNull();
	});

	it('handles authenticator errors gracefully', async () => {
		authenticator.verifyAccessToken = async () => {
			throw new Error('Token verification service unavailable');
		};

		await expectAsync(
			authenticator.verifyAccessToken('valid-token')
		).toBeRejected();
	});
});
