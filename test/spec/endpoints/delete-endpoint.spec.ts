import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('DeleteUserEndpoint (integration)', () => {
	it('deletes an existing user', async () => {
		const email = `delete+${Date.now()}@example.com`;
		const name = 'User to Delete';

		// Create a test user
		const created = await repo.insertOne({
			record: {
				name,
				email,
			},
		});

		const url = `${env.API_URL}/users/${created.id}`;

		const res = await fetch(url, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(204);

		// Confirm the record is deleted from the database
		const record = await repo.findOne({
			where: <User>{ id: created.id },
		});
		expect(record).toBeNull();
	});

	it('returns 404 when deleting a non-existent user', async () => {
		const url = `${env.API_URL}/users/99999`;

		const res = await fetch(url, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(404);
	});

	it('should have correct endpoint configuration', async () => {
		const { RiaoDeleteEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoDeleteEndpoint<User>();

		expect(endpoint.path).toBe('/:id');
		expect(endpoint.statusCode).toBe(204);
		expect(endpoint.getErrors().not_found).toBeDefined();
	});
});
