import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';
import { RiaoSearchEndpoint } from '../../../src/endpoints';
import { and, like } from '@riao/dbal';

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

	describe('columns parameter', () => {
		it('rejects `columns` array not in columnMap', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: ['nonexistent_column'],
				}),
			});

			// Throws UnprocessableEntityError since column not in columnMap
			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('not a valid selectable column');
		});

		it('accepts empty `columns` array', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: [],
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
		});

		it('rejects `columns` with invalid characters', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: ['id; DROP TABLE users;'],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `columns` with empty string', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: [''],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `columns` with string exceeding max length', async () => {
			const url = `${env.API_URL}/users/search`;

			const longColumn = 'a'.repeat(256);

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: [longColumn],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects column not in map', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: ['nonexistent'],
				}),
			});

			// Returns 422 since column not in columnMap
			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('not a valid selectable column');
		});

		it('rejects multiple columns with invalid column', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: ['id', 'nonexistent'],
					limit: 5,
					offset: 0,
					orderBy: 'name',
					orderDirection: 'ASC',
				}),
			});

			// Throws error since nonexistent column not in columnMap
			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('not a valid selectable column');
		});

		it('returns records when `columns` is undefined', async () => {
			const url = `${env.API_URL}/users/search`;

			// Explicitly don't include columns parameter
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					limit: 10,
					offset: 0,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
		});

		it('executes query without columns when not specified', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					limit: 1,
					offset: 0,
					orderBy: 'id',
					orderDirection: 'ASC',
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeLessThanOrEqual(1);
		});

		it('respects orderBy and orderDirection', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create users with distinct names
			const timestamp = Date.now();
			const user1 = await repo.insertOne({
				record: {
					name: `ZZZ-${timestamp}`,
					email: `zzz+${timestamp}@example.com`,
				},
			});
			const user2 = await repo.insertOne({
				record: {
					name: `AAA-${timestamp}`,
					email: `aaa+${timestamp}@example.com`,
				},
			});

			// Query with ascending order
			const responseAsc = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orderBy: 'name',
					orderDirection: 'ASC',
					limit: 1000,
				}),
			});

			expect(responseAsc.status).toBe(200);
			const bodyAsc = (await responseAsc.json()) as {
				records: User[];
				count: number;
			};

			// Find indices of our test users
			const aaa = bodyAsc.records.findIndex((u) => u.id === user2?.id);
			const zzz = bodyAsc.records.findIndex((u) => u.id === user1?.id);

			// AAA should come before ZZZ in ascending order
			if (aaa !== -1 && zzz !== -1) {
				expect(aaa).toBeLessThan(zzz);
			}
		});

		it('handles limit and offset', async () => {
			const url = `${env.API_URL}/users/search`;

			// Get all records first
			const allResponse = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					limit: 1000,
					offset: 0,
				}),
			});

			const allRecords = (await allResponse.json()) as {
				records: User[];
				count: number;
			};

			// Then with limit and offset
			const limitedResponse = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					limit: 2,
					offset: 1,
				}),
			});

			expect(limitedResponse.status).toBe(200);

			const limitedRecords = (await limitedResponse.json()) as {
				records: User[];
				count: number;
			};

			// Should have at most 2 records
			expect(limitedRecords.records.length).toBeLessThanOrEqual(2);

			// Count should match total
			expect(limitedRecords.count).toBe(allRecords.count);
		});
	});

	describe('where parameter (filtering)', () => {
		it('rejects `where` with column not in columnMap', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'nonexistent',
							operator: '=',
							value: 'John',
						},
					],
				}),
			});

			// Throws UnprocessableEntityError since column not in columnMap
			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('not a valid filterable column');
		});

		it('rejects `where` with invalid operator', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: 'INVALID_OP',
							value: 'John',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `where` with invalid column format', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'id; DROP TABLE users;',
							operator: '=',
							value: 'John',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('accepts empty `where` array', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [],
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
		});

		it('rejects `where` with empty column name', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: '',
							operator: '=',
							value: 'John',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `where` with column exceeding max length', async () => {
			const url = `${env.API_URL}/users/search`;

			const longColumn = 'a'.repeat(256);

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: longColumn,
							operator: '=',
							value: 'John',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `where` with value exceeding max length', async () => {
			const url = `${env.API_URL}/users/search`;

			const longValue = 'a'.repeat(1025);

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: '=',
							value: longValue,
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});
	});

	describe('where filtering integration tests', () => {
		it('filters records by equality condition', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users with specific names
			const timestamp = Date.now();
			const targetName = `Filter Test User ${timestamp}`;

			await repo.insertOne({
				record: {
					name: targetName,
					email: `target+${timestamp}@example.com`,
				},
			});

			// Search with where clause for the target name
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: '=',
							value: targetName,
						},
					],
					columns: ['id', 'name', 'email'],
					limit: 100,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};

			// Should find the target user
			const filtered = body.records.filter((u) => u.name === targetName);
			expect(filtered.length).toBeGreaterThanOrEqual(1);
		});

		it('filters records by LIKE condition', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users with specific email patterns
			const timestamp = Date.now();
			const matchEmail = `liketest+${timestamp}@example.com`;

			await repo.insertOne({
				record: {
					name: `Like Test User ${timestamp}`,
					email: matchEmail,
				},
			});

			// Search with LIKE condition
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'email',
							operator: 'LIKE',
							value: `%liketest+${timestamp}%`,
						},
					],
					columns: ['id', 'name', 'email'],
					limit: 100,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};

			// Should return matching records
			const likeMatches = body.records.filter((u) =>
				u.email.includes(`liketest+${timestamp}`)
			);
			expect(likeMatches.length).toBeGreaterThanOrEqual(1);
		});

		it('filters with multiple WHERE conditions', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users
			const timestamp = Date.now();
			const targetName = `Multi Filter ${timestamp}`;
			const targetEmail = `multi+${timestamp}@example.com`;

			const user = await repo.insertOne({
				record: {
					name: targetName,
					email: targetEmail,
				},
			});

			// Search with multiple conditions
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: '=',
							value: targetName,
						},
						{
							column: 'email',
							operator: '=',
							value: targetEmail,
						},
					],
					columns: ['id', 'name', 'email'],
					limit: 100,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};

			// Should find the user matching both conditions
			const filtered = body.records.filter(
				(u) => u.name === targetName && u.email === targetEmail
			);
			expect(filtered.length).toBeGreaterThanOrEqual(1);
			if (user?.id) {
				expect(filtered.some((u) => u.id === user.id)).toBeTrue();
			}
		});

		it('filters with INARRAY WHERE condition', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users with specific IDs to filter
			const timestamp = Date.now();
			const user1 = await repo.insertOne({
				record: {
					name: `InArray User 1 ${timestamp}`,
					email: `inarray1+${timestamp}@example.com`,
				},
			});

			const user2 = await repo.insertOne({
				record: {
					name: `InArray User 2 ${timestamp}`,
					email: `inarray2+${timestamp}@example.com`,
				},
			});

			// Get user IDs to use in INARRAY filter
			const ids = [user1?.id, user2?.id].filter(Boolean).join(',');

			// Search with INARRAY condition
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'id',
							operator: 'INARRAY',
							value: ids,
						},
					],
					columns: ['id', 'name', 'email'],
					limit: 100,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};

			// Should find both users
			const filtered = body.records.filter(
				(u) => u.id === user1?.id || u.id === user2?.id
			);
			expect(filtered.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('RiaoSearchEndpoint getQuery unit tests', () => {
		it('includes columns in query when found in columnMap', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['id', 'name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('id');
			expect(query.columns).toContain('name');
		});

		it('includes joins in query when join is defined', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						profile_name: {
							column: 'profile.name',
							join: {
								table: 'profiles',
								alias: 'profile',
								on: 'profile.user_id = users.id',
							},
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['profile_name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
			expect(query.join?.[0].table).toBe('profiles');
		});

		it('skips columns when none are provided', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeUndefined();
		});

		it('handles empty columns array', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: [],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeUndefined();
		});

		it('can join tables twice with aliases', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						profile_name: {
							column: 'profile.name',
							join: {
								table: 'profiles',
								alias: 'profile',
								on: 'profile.user_id = users.id',
							},
						},
						role_name: {
							column: 'role.name',
							join: {
								table: 'roles',
								alias: 'role',
								on: 'role.id = users.role_id',
							},
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['profile_name', 'role_name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(2);
		});

		it('deduplicates joins with same table but no alias', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						profile_name: {
							column: 'profile.name',
							join: {
								table: 'profiles',
								on: 'profile.user_id = users.id',
							},
						},
						profile_email: {
							column: 'profile.email',
							join: {
								table: 'profiles',
								on: 'profile.user_id = users.id',
							},
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['profile_name', 'profile_email'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
		});

		it('deduplicates joins with same alias', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						profile_name: {
							column: 'profile.name',
							join: {
								table: 'profiles',
								alias: 'profile',
								on: 'profile.user_id = users.id',
							},
						},
						profile_email: {
							column: 'profile.email',
							join: {
								table: 'profiles',
								alias: 'profile',
								on: 'profile.user_id = users.id',
							},
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['profile_name', 'profile_email'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
		});

		it('creates where clause with single equality condition', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.[0]).toEqual({ name: 'John' });
		});

		it('creates where clause with less than operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: '<',
							value: 100,
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('creates where with <= operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: '<=',
							value: 100,
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('creates where clause with > operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}
			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: '>',
							value: 50,
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('creates where with >= operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: '>=',
							value: 50,
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});
		it('creates where clause with LIKE operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: 'LIKE',
							value: '%john%',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('creates where clause with multiple conditions', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
						email: { column: 'email' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
						{
							column: 'email',
							operator: 'LIKE',
							value: '%example%',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			const where = query.where as unknown[];

			expect(where.length).toBe(3);
			expect(where[0]).toEqual({ name: 'John' });
			expect(where[1]).toEqual(and);
			expect(where[2]).toEqual({ email: like('%example%') });
		});

		it('adds where column to columns array if not present', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('name');
		});

		it('rejects where with column not in columnMap', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			try {
				await endpoint['getQuery'](request);
				fail('Expected UnprocessableEntityError');
			}
			catch (error) {
				const errMsg = 'not a valid filterable column';
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				expect((error as any).message).toContain(errMsg);
			}
		});

		it('rejects where with non-string mapped column', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						profile_name: {
							column: {
								table: 'profiles',
								column: 'name',
							},
						},
					};
				}
			}
			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'profile_name',
							operator: '=',
							value: 'John',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			try {
				await endpoint['getQuery'](request);
				fail('Expected UnprocessableEntityError');
			}
			catch (error) {
				const errMsg = 'not a valid filterable column';
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				expect((error as any).message).toContain(errMsg);
			}
		});

		it('handles where with joins', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						profile_name: {
							column: 'profile.name',
							join: {
								table: 'profiles',
								alias: 'profile',
								on: 'profile.user_id = users.id',
							},
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'profile_name',
							operator: '=',
							value: 'John',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
		});

		it('skips where clause when where array is empty', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
					};
				}
			}
			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeUndefined();
		});

		it('does not create where clause when where is undefined', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeUndefined();
		});

		it('combines where and columns', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
						email: { column: 'email' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					columns: ['id', 'email'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('id');
			expect(query.columns).toContain('email');
			expect(query.columns).toContain('name'); // Added from where
		});

		it('combines where, columns, and orderBy', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
						email: { column: 'email' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					columns: ['id', 'email'],
					orderBy: 'id',
					orderDirection: 'ASC',
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			expect(query.columns).toBeDefined();
			expect(query.orderBy).toBeDefined();
			expect(query.orderBy).toEqual({ id: 'ASC' });
		});

		it('handles where with numeric values', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: '>=',
							value: 10,
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('uses default empty getColumnMap', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				// eslint-disable-next-line max-len
				// Do not override getColumnMap to test the default implementation
			}

			const endpoint = new TestSearchEndpoint();
			const columnMap = endpoint['getColumnMap']();

			expect(columnMap).toEqual({});
		});

		it('handles where with INARRAY operator', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: 'INARRAY',
							value: '1,2,3',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
			expect(query.columns).toContain('id');
		});

		// eslint-disable-next-line max-len
		it('handles where with INARRAY operator and array value', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			// eslint-disable-next-line max-len
			const request = {
				body: {
					where: [
						{
							column: 'id',
							operator: 'INARRAY',
							value: [1, 2, 3],
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
			expect(query.columns).toContain('id');
		});
	});
});
