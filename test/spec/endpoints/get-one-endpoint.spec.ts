import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('GetOneUserEndpoint (integration)', () => {
	it('retrieves a single user by id', async () => {
		const email = `getone+${Date.now()}@example.com`;
		const name = 'Get One User';

		// Create a test user
		const created = await repo.insertOne({
			record: {
				name,
				email,
			},
		});

		const url = `${env.API_URL}/users/${created.id}`;
		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as User;
		expect(body).toBeDefined();
		if (created && created.id) {
			expect(body.id).toBe(created.id);
		}
		expect(body.email).toBe(email);
		expect(body.name).toBe(name);
	});

	it('returns 404 when user does not exist', async () => {
		const url = `${env.API_URL}/users/99999`;

		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(404);
	});

	it('should have correct endpoint configuration', async () => {
		const { RiaoGetOneEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoGetOneEndpoint<User>();

		expect(endpoint.path).toBe('/:id');
		expect(endpoint.getErrors().not_found).toBeDefined();
	});
});
