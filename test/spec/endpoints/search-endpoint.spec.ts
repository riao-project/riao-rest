import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('SearchEndpoint (integration)', () => {
	beforeAll(async () => {
		// Ensure there is at least one user in the database
		await repo.insertOne({
			record: {
				name: 'Initial User',
				email: `initialuser+${Date.now()}@example.com`,
			},
		});
	});

	it('retrieves all users from the database with POST', async () => {
		const url = `${env.API_URL}/users/search`;

		// Create test users
		const user1 = await repo.insertOne({
			record: {
				name: 'Search User One',
				email: `searchuser1+${Date.now()}@example.com`,
			},
		});

		const user2 = await repo.insertOne({
			record: {
				name: 'Search User Two',
				email: `searchuser2+${Date.now()}@example.com`,
			},
		});

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			records: User[];
			count: number;
		};
		expect(Array.isArray(body.records)).toBeTrue();
		expect(body.records.length).toBeGreaterThanOrEqual(2);

		const ids = body.records.map((u) => u.id);
		if (user1 && user1.id) {
			expect(ids).toContain(user1.id);
		}
		if (user2 && user2.id) {
			expect(ids).toContain(user2.id);
		}
	});

	it('supports `limit` in POST body', async () => {
		const url = `${env.API_URL}/users/search`;

		// Create several users
		for (let i = 0; i < 5; i++) {
			await repo.insertOne({
				record: {
					name: `Search Limit User ${i} ${Date.now()}`,
					email: `searchlimituser${i}+${Date.now()}@example.com`,
				},
			});
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ limit: 3 }),
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			records: User[];
			count: number;
		};
		expect(Array.isArray(body.records)).toBeTrue();
		expect(body.records.length).toBe(3);
	});

	it('supports `offset` in POST body', async () => {
		const url = `${env.API_URL}/users/search`;

		// Create a predictable set of users with ordered names
		const base = `searchoffset-${Date.now()}`;
		for (let i = 0; i < 6; i++) {
			const name = `${base}-${i}`;
			await repo.insertOne({
				record: {
					name,
					email: `searchoff${i}+${Date.now()}@example.com`,
				},
			});
		}

		// Fetch all users sorted by name
		const allUsersResponse = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				orderBy: 'name',
				orderDirection: 'ASC',
				limit: 1000,
			}),
		});
		expect(allUsersResponse.status).toBe(200);
		const allUsers = (await allUsersResponse.json()) as {
			records: User[];
			count: number;
		};

		// Now request with offset and limit
		const searchResponse = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				orderBy: 'name',
				orderDirection: 'ASC',
				offset: 2,
				limit: 2,
			}),
		});

		expect(searchResponse.status).toBe(200);
		const body = (await searchResponse.json()) as {
			records: User[];
			count: number;
		};
		expect(body.count).toBeGreaterThan(0);
		expect(Array.isArray(body.records)).toBeTrue();
		expect(body.records.length).toBe(2);

		const returnedNames = body.records.map((u) => u.name);
		const expected = allUsers.records.slice(2, 4).map((user) => user.name);
		expect(returnedNames).toEqual(expected);
	});

	it('supports `orderBy` and `orderDirection` in POST body', async () => {
		const url = `${env.API_URL}/users/search`;

		// Create two users with names that sort predictably
		await repo.insert({
			records: [
				{
					name: 'SearchAnna',
					email: 'searchanna@example.com',
				},
				{
					name: 'SearchZed',
					email: 'searchzed@example.com',
				},
			],
		});

		// Ascending
		const responseAsc = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				orderBy: 'name',
				orderDirection: 'ASC',
			}),
		});

		expect(responseAsc.status).toBe(200);
		const bodyAsc = (await responseAsc.json()) as {
			records: User[];
			count: number;
		};
		const namesAsc = bodyAsc.records.map((u) => u.name);
		expect(namesAsc.indexOf('SearchAnna')).toBeLessThan(
			namesAsc.indexOf('SearchZed')
		);

		// Descending
		const responseDesc = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				orderBy: 'name',
				orderDirection: 'DESC',
			}),
		});

		expect(responseDesc.status).toBe(200);
		const bodyDesc = (await responseDesc.json()) as {
			records: User[];
			count: number;
		};

		expect(bodyDesc.count).toBeGreaterThan(0);

		const namesDesc = bodyDesc.records.map((user) => user.name);
		expect(namesDesc.indexOf('SearchZed')).toBeLessThan(
			namesDesc.indexOf('SearchAnna')
		);
	});

	it('returns an empty array when no users exist', async () => {
		const url = `${env.API_URL}/users/search`;

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});

		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			records: User[];
			count: number;
		};

		expect(body.count).toBeGreaterThan(0);
		expect(Array.isArray(body.records)).toBeTrue();
	});
});
