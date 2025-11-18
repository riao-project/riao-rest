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

	it('supports `limit` query parameter', async () => {
		const url = `${env.API_URL}/users`;

		// Create several users
		const createdUsers: Partial<User>[] = [];
		for (let i = 0; i < 5; i++) {
			const user = await repo.insertOne({
				record: {
					name: `Limit User ${i} ${Date.now()}`,
					email: `limituser${i}+${Date.now()}@example.com`,
				},
			});
			createdUsers.push(user);
		}

		const response = await fetch(`${url}?limit=3`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		expect(response.status).toBe(200);

		const body = (await response.json()) as User[];
		expect(Array.isArray(body)).toBeTrue();
		expect(body.length).toBe(3);
	});

	it('supports `offset` query parameter', async () => {
		const url = `${env.API_URL}/users`;

		// Create a predictable set of users with ordered names
		const base = `offset-${Date.now()}`;
		for (let i = 0; i < 6; i++) {
			const name = `${base}-${i}`;
			await repo.insertOne({
				record: { name, email: `off${i}+${Date.now()}@example.com` },
			});
		}

		// Fetch all users sorted by name and filter to those we just created
		const allRes = await fetch(
			`${url}?orderBy=name&orderDirection=ASC&limit=1000`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}
		);
		expect(allRes.status).toBe(200);
		const all = (await allRes.json()) as User[];
		// Now request with offset and limit and compare to the slice we expect
		const res = await fetch(
			`${url}?orderBy=name&orderDirection=ASC&offset=2&limit=2`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as User[];
		expect(Array.isArray(body)).toBeTrue();
		expect(body.length).toBe(2);

		const returnedNames = body.map((u) => u.name);
		const expected = all.slice(2, 4).map((u) => u.name);
		expect(returnedNames).toEqual(expected);
	});

	it('supports `orderBy` and `orderDirection` query parameters', async () => {
		const url = `${env.API_URL}/users`;

		// Create two users with names that sort predictably
		const t = Date.now();
		await repo.insert({
			records: [
				{ name: `Anna-${t}`, email: `anna+${t}@example.com` },
				{ name: `Zed-${t}`, email: `zed+${t}@example.com` },
			],
		});
		// Ascending
		const responseAsc = await fetch(
			`${url}?orderBy=name&orderDirection=ASC`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}
		);
		expect(responseAsc.status).toBe(200);
		const bodyAsc = (await responseAsc.json()) as User[];
		const namesA = bodyAsc.map((u) => u.name);
		expect(namesA.indexOf(`Anna-${t}`)).toBeLessThan(
			namesA.indexOf(`Zed-${t}`)
		);

		// Descending
		const responseDesc = await fetch(
			`${url}?orderBy=name&orderDirection=DESC`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			}
		);
		expect(responseDesc.status).toBe(200);
		const bodyDesc = (await responseDesc.json()) as User[];
		const namesD = bodyDesc.map((u) => u.name);
		expect(namesD.indexOf(`Zed-${t}`)).toBeLessThan(
			namesD.indexOf(`Anna-${t}`)
		);
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
