import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('GetListUsersEndpoint (integration)', () => {
	it('retrieves all users from the database', async () => {
		const url = `${env.API_URL}/users`;

		// Create test users
		const user1 = await repo.insertOne({
			record: {
				name: 'User One',
				email: `user1+${Date.now()}@example.com`,
			},
		});

		const user2 = await repo.insertOne({
			record: {
				name: 'User Two',
				email: `user2+${Date.now()}@example.com`,
			},
		});

		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as User[];
		expect(Array.isArray(body)).toBeTrue();
		expect(body.length).toBeGreaterThanOrEqual(2);

		const ids = body.map((u) => u.id);
		expect(ids.length).toBeGreaterThanOrEqual(2);
		if (user1 && user1.id) {
			expect(ids).toContain(user1.id);
		}
		if (user2 && user2.id) {
			expect(ids).toContain(user2.id);
		}
	});

	it('returns an empty array when no users exist', async () => {
		// This test assumes a fresh database per test run
		const url = `${env.API_URL}/users`;

		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as User[];
		expect(Array.isArray(body)).toBeTrue();
	});
});
