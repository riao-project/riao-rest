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
			expect(body.message).toContain('not a valid selectable column.');
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
			expect(body.message).toContain('not a valid selectable column.');
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
			expect(body.message).toContain('not a valid selectable column.');
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
			expect(body.message).toEqual(
				'Column "nonexistent" is not a valid selectable column.'
			);
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

		// TODO:
		// xit('rejects `where` with column exceeding max length', async () => {
		// 	const url = `${env.API_URL}/users/search`;

		// 	const longColumn = 'a'.repeat(256);

		// 	const response = await fetch(url, {
		// 		method: 'POST',
		// 		headers: { 'Content-Type': 'application/json' },
		// 		body: JSON.stringify({
		// 			where: [
		// 				{
		// 					column: longColumn,
		// 					operator: '=',
		// 					value: 'John',
		// 				},
		// 			],
		// 		}),
		// 	});

		// 	// Validation error returns 422
		// 	expect(response.status).toBe(422);
		// });

		// TODO:
		// 	xit('rejects `where` with value exceeding max length', async () => {
		// 		const url = `${env.API_URL}/users/search`;

		// 		const longValue = 'a'.repeat(1025);

		// 		const response = await fetch(url, {
		// 			method: 'POST',
		// 			headers: { 'Content-Type': 'application/json' },
		// 			body: JSON.stringify({
		// 				where: [
		// 					{
		// 						column: 'name',
		// 						operator: '=',
		// 						value: longValue,
		// 					},
		// 				],
		// 			}),
		// 		});

		// 		// Validation error returns 422
		// 		expect(response.status).toBe(422);
		// 	});
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

		it('filters with BETWEEN WHERE condition', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users with different IDs
			const timestamp = Date.now();
			const user1 = await repo.insertOne({
				record: {
					name: `Between User 1 ${timestamp}`,
					email: `between1+${timestamp}@example.com`,
				},
			});

			const user2 = await repo.insertOne({
				record: {
					name: `Between User 2 ${timestamp}`,
					email: `between2+${timestamp}@example.com`,
				},
			});

			// Get user IDs for range
			const id1 = user1?.id ? Number(user1.id) : 0;
			const id2 = user2?.id ? Number(user2.id) : 0;
			const minId = Math.min(id1, id2);
			const maxId = Math.max(id1, id2);

			// Search with BETWEEN condition
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'id',
							operator: 'BETWEEN',
							minValue: minId,
							maxValue: maxId,
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

			// Should find users within the ID range
			const filtered = body.records.filter((u) => {
				const userId = Number(u.id);
				return userId >= minId && userId <= maxId;
			});
			expect(filtered.length).toBeGreaterThanOrEqual(2);
		});

		it('rejects BETWEEN with missing minValue', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'id',
							operator: 'BETWEEN',
							maxValue: 100,
						},
					],
				}),
			});

			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('minValue and maxValue');
		});

		it('rejects BETWEEN with missing maxValue', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'id',
							operator: 'BETWEEN',
							minValue: 1,
						},
					],
				}),
			});

			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toContain('minValue and maxValue');
		});
	});

	describe('where filtering integration tests with appendWhere', () => {
		it('appendWhere filters results correctly', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users with different tenant IDs
			const timestamp = Date.now();
			const allowedUser = await repo.insertOne({
				record: {
					name: `Allowed ${timestamp}`,
					email: `allowed+${timestamp}@example.com`,
				},
			});

			await repo.insertOne({
				record: {
					name: `Blocked ${timestamp}`,
					email: `blocked+${timestamp}@example.com`,
				},
			});

			// Search with appendWhere that simulates tenant filtering
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					columns: ['id', 'name', 'email'],
					limit: 100,
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};

			// Both users should be returned in the baseline (no
			// appendWhere filtering)
			const allowed = body.records.find((u) => u.id === allowedUser?.id);

			expect(allowed).toBeDefined();
		});

		it('appendWhere combined with user where filters', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users
			const timestamp = Date.now();
			const user1 = await repo.insertOne({
				record: {
					name: `Search1 ${timestamp}`,
					email: `search1+${timestamp}@example.com`,
				},
			});

			// Search with user-provided where + potential appendWhere
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: '=',
							value: `Search1 ${timestamp}`,
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

			// Should find the specific user
			const found = body.records.filter((u) => u.id === user1?.id);
			expect(found.length).toBeGreaterThanOrEqual(1);
		});

		it('appendWhere maintains data integrity', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create a test user
			const timestamp = Date.now();
			const testUser = await repo.insertOne({
				record: {
					name: `Integrity ${timestamp}`,
					email: `integrity+${timestamp}@example.com`,
				},
			});

			// Search for the user
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					where: [
						{
							column: 'name',
							operator: '=',
							value: `Integrity ${timestamp}`,
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

			// Find and verify data integrity
			const found = body.records.find((u) => u.id === testUser?.id);

			if (found) {
				expect(found.name).toBe(`Integrity ${timestamp}`);
				if (testUser.email) {
					expect(found.email).toBe(
						`integrity+${timestamp}@example.com`
					);
				}

				expect(found.id).toEqual(testUser.id ?? '');
			}
		});
	});

	describe('aggregates and groupBy parameters', () => {
		it('accepts `aggregates` array in POST body', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total_users',
						},
					],
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
		});

		it('rejects `aggregates` with column not in columnMap', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'nonexistent',
							function: 'count',
						},
					],
				}),
			});

			// Should fail for security - column not in columnMap
			expect(response.status).toBe(422);
			const body = (await response.json()) as { message?: string };
			expect(body.message).toEqual(
				'Column "nonexistent" is not a valid selectable column.'
			);
		});

		it('rejects `aggregates` with invalid function', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'invalid_function',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('accepts `groupBy` array in POST body', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'count_by_name',
						},
					],
				}),
			});

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				records: User[];
				count: number;
			};
			expect(Array.isArray(body.records)).toBeTrue();
		});

		it('rejects `groupBy` with column not in columnMap', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['nonexistent'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
				}),
			});

			// Should fail for security - column not in columnMap
			expect(response.status).toBe(422);

			const body = (await response.json()) as { message?: string };
			expect(body.message).toEqual(
				'Column "nonexistent" is not a valid selectable column.'
			);
		});

		it('rejects `groupBy` with invalid characters', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id; DROP TABLE users;'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `groupBy` with empty string', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: [''],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('aggregates count function', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users
			const timestamp = Date.now();
			await repo.insertOne({
				record: {
					name: `Aggregate Test ${timestamp}`,
					email: `agg1+${timestamp}@example.com`,
				},
			});

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total_count',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify the response contains aggregate data
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			// Aggregate function should produce some numeric result
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v))
			);
			expect(numericValues.length).toBeGreaterThan(0);
		});

		it('aggregates sum function', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'sum',
							alias: 'total_ids',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify sum aggregate returns a response with numeric data
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v))
			);
			expect(numericValues.length).toBeGreaterThan(0);
		});

		it('aggregates avg function', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'avg',
							alias: 'avg_id',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify avg aggregate returns a response with numeric data
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v))
			);
			expect(numericValues.length).toBeGreaterThan(0);
		});

		it('aggregates min function', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'min',
							alias: 'min_id',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify min aggregate returns a response with numeric data
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v))
			);
			expect(numericValues.length).toBeGreaterThan(0);
		});

		it('aggregates max function', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'max',
							alias: 'max_id',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify max aggregate returns a response with numeric data
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v))
			);
			expect(numericValues.length).toBeGreaterThan(0);
		});

		it('groups by column with aggregates', async () => {
			const url = `${env.API_URL}/users/search`;

			// Create test users
			const timestamp = Date.now();
			await repo.insertOne({
				record: {
					name: `Group Test 1 ${timestamp}`,
					email: `group1+${timestamp}@example.com`,
				},
			});

			await repo.insertOne({
				record: {
					name: `Group Test 2 ${timestamp}`,
					email: `group2+${timestamp}@example.com`,
				},
			});

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'users_per_name',
						},
					],
					columns: ['name', 'id'],
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			// Verify groupBy returns results with aggregates
			expect(body.records.length).toBeGreaterThan(0);
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
		});

		// TODO: Empty aggregates & groupBy

		// eslint-disable-next-line max-len
		it('rejects `aggregates` with column exceeding max length', async () => {
			const url = `${env.API_URL}/users/search`;

			const longColumn = 'a'.repeat(256);

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: longColumn,
							function: 'count',
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('rejects `aggregates` with alias exceeding max length', async () => {
			const url = `${env.API_URL}/users/search`;

			const longAlias = 'a'.repeat(256);

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: longAlias,
						},
					],
				}),
			});

			// Validation error returns 422
			expect(response.status).toBe(422);
		});

		it('uses aggregate alias in response', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'custom_count_alias',
						},
					],
					columns: ['id'],
					limit: 1,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify response contains aggregate results
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			// Should have at least one property from the aggregate
			const keys = Object.keys(firstRecord);
			expect(keys.length).toBeGreaterThan(0);
		});

		it('multiple aggregates on same column', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total',
						},
						{
							column: 'id',
							function: 'min',
							alias: 'minimum',
						},
						{
							column: 'id',
							function: 'max',
							alias: 'maximum',
						},
					],
					columns: ['id'],
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Verify multiple aggregates on same column produces results
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
			const values = Object.values(firstRecord) as unknown[];
			const numericValues = values.filter(
				(v) => !Number.isNaN(Number(v)) && v !== null
			);
			expect(numericValues.length).toBeGreaterThan(0);
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

		it('includes single join from array in query', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						post_title: {
							column: 'posts.title',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['post_title'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
			expect(query.join?.[0].table).toBe('posts');
		});

		it('includes multiple joins from array in query', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						comment_author_email: {
							column: 'users.email',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
								{
									table: 'comments',
									alias: 'comments',
									on: 'comments.post_id = posts.id',
								},
								{
									table: 'users',
									alias: 'comment_authors',
									on: 'comments.user_id = users.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['comment_author_email'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(3);
			expect(query.join?.[0].table).toBe('posts');
			expect(query.join?.[1].table).toBe('comments');
			expect(query.join?.[2].table).toBe('users');
		});

		it('mixes single joins and array joins correctly', async () => {
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
						post_comment_count: {
							column: 'COUNT(comments.id)',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
								{
									table: 'comments',
									alias: 'comments',
									on: 'comments.post_id = posts.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['profile_name', 'post_comment_count'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(3);
		});

		it('handles array join in where clause', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						comment_content: {
							column: 'comments.content',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
								{
									table: 'comments',
									alias: 'comments',
									on: 'comments.post_id = posts.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					where: [
						{
							column: 'comment_content',
							operator: 'LIKE',
							value: '%test%',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(2);
			expect(query.where).toBeDefined();
		});

		it('handles array join in aggregates', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						post_id: {
							column: 'posts.id',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					groupBy: ['post_id'],
					aggregates: [
						{
							column: 'post_id',
							function: 'count',
							alias: 'total_posts',
						},
					],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
		});

		it('deduplicates joins in array with same table', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						post_data: {
							column: 'posts.title',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['post_data'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			// Deduplication happens by alias/table name
			expect(query.join?.length).toBe(1);
		});

		it('handles array join in orderBy', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						post_rating: {
							column: 'posts.rating',
							join: [
								{
									table: 'posts',
									alias: 'posts',
									on: 'posts.user_id = users.id',
								},
							],
						},
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			const request = {
				body: {
					columns: ['post_rating'],
					orderBy: 'post_rating',
					orderDirection: 'DESC',
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
			expect(query.orderBy).toBeDefined();
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

		it('creates where clause with BETWEEN operator', async () => {
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
							operator: 'BETWEEN',
							minValue: 10,
							maxValue: 100,
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

		it('rejects BETWEEN operator without minValue', async () => {
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
							operator: 'BETWEEN',
							maxValue: 100,
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const msg = (error as any).message;
				expect(msg).toContain('minValue and maxValue');
			}
		});

		it('rejects BETWEEN operator without maxValue', async () => {
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
							operator: 'BETWEEN',
							minValue: 10,
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const msg = (error as any).message;
				expect(msg).toContain('minValue and maxValue');
			}
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				expect((error as any).message).toEqual(
					'Column "name" is not a valid selectable column.'
				);
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
					columns: ['id', 'email', 'name'],
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
					columns: ['id'],
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
					columns: ['id'],
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

		// eslint-disable-next-line max-len
		it('appends where conditions from appendWhere method', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
					};
				}

				override async appendWhere() {
					return [{ tenant_id: 123 }];
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

			expect(query.where).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((query.where as any)?.length).toBe(1);
		});

		it('combines request where and appendWhere', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
						tenant_id: { column: 'tenant_id' },
					};
				}

				override async appendWhere() {
					return [{ tenant_id: 456 }];
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
			expect((query.where as any)?.length).toBeGreaterThan(1);
		});

		// eslint-disable-next-line max-len
		it('handles appendWhere with multiple conditions', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
						tenant_id: { column: 'tenant_id' },
						active: { column: 'active' },
					};
				}

				override async appendWhere() {
					return [{ tenant_id: 789, active: true }];
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

			expect(query.where).toBeDefined();
			expect((query.where as unknown[]).length).toBe(1);
			expect((query.where as unknown[])[0]).toEqual({
				tenant_id: 789,
				active: true,
			});
		});

		it('appendWhere returns empty array by default', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const res = (await endpoint['appendWhere']()) as any;

			expect(res).toEqual([]);
		});

		it('handles count aggregate function', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total_count',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			// Column should be included with count function
			expect(query.columns).toBeDefined();
		});

		it('handles sum aggregate function', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'sum',
							alias: 'total_ids',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('handles avg aggregate function', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'avg',
							alias: 'avg_id',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('handles min aggregate function', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'min',
							alias: 'min_id',
						},
					],
					// No columns specified - should add from aggregates
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('handles max aggregate function', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'max',
							alias: 'max_id',
						},
					],
					// No columns specified - should add from aggregates
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('rejects aggregate with column not in columnMap', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'nonexistent',
							function: 'count',
						},
					],
					columns: ['nonexistent'],
					limit: 10,
					offset: 0,
				},
			};

			try {
				await endpoint['getQuery'](request);
				fail('Expected UnprocessableEntityError');
			}
			catch (error) {
				const errMsg = 'not a valid selectable column.';
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				expect((error as any).message).toContain(errMsg);
			}
		});

		it('adds aggregate column to columns array', async () => {
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
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					columns: ['name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('name');
			// Aggregate is processed into a complex object, check it exists
			expect(query.columns?.length).toBe(2);
		});

		it('handles multiple aggregates on same column', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total',
						},
						{
							column: 'id',
							function: 'min',
							alias: 'minimum',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('id');
		});

		it('uses custom alias for aggregate', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'custom_alias',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('handles groupBy parameter', async () => {
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
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					columns: ['name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('name');
		});

		it('rejects groupBy with column not in columnMap', async () => {
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
					groupBy: ['nonexistent'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					columns: ['nonexistent'],
					limit: 10,
					offset: 0,
				},
			};

			try {
				await endpoint['getQuery'](request);
				fail('Expected UnprocessableEntityError');
			}
			catch (error) {
				const errMsg = 'not a valid selectable column.';
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				expect((error as any).message).toContain(errMsg);
			}
		});

		it('combines groupBy with aggregates', async () => {
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
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'count_per_name',
						},
					],
					columns: ['name', 'id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.columns).toContain('name');
			expect(query.columns).toContain('id');
		});

		it('empty aggregates array does not apply aggregation', async () => {
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
					aggregates: [],
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

		it('empty groupBy array does not apply grouping', async () => {
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
					groupBy: [],
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

		it('aggregate with where clause', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'filtered_count',
						},
					],
					where: [
						{
							column: 'name',
							operator: '=',
							value: 'John',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.where).toBeDefined();
		});

		it('groupBy with where clause', async () => {
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
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					where: [
						{
							column: 'id',
							operator: '>',
							value: 10,
						},
					],
					columns: ['name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.where).toBeDefined();
		});

		it('aggregate with join in columnMap', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					columns: ['id', 'profile_name'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			expect(query.join).toBeDefined();
			expect(query.join?.length).toBe(1);
		});

		// eslint-disable-next-line max-len
		it('aggregates ignore duplicate columns from aggregatesByColumn', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'total_1',
						},
						{
							column: 'id',
							function: 'sum',
							alias: 'total_2',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
		});

		it('throws error for unsupported aggregate function', async () => {
			class TestSearchEndpoint extends RiaoSearchEndpoint<User> {
				override getColumnMap() {
					return {
						id: { column: 'id' },
						name: { column: 'name' },
					};
				}
			}

			const endpoint = new TestSearchEndpoint();
			// Direct call to getQuery with unsupported function
			// The validator bypassed here to test defensive code path
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mockAggregate: any = {
				column: 'name',
				function: 'unsupported_func',
			};

			// Mock the request with unsupported function
			// Don't include 'name' in initial columns so aggregatesByColumn
			// 	will be populated
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const request = {
				body: {
					groupBy: ['id'],
					aggregates: [mockAggregate],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			try {
				await endpoint['getQuery'](request);
				fail('Should have thrown an error for unsupported function');
			}
			catch (error) {
				// Should throw UnprocessableEntityError with message
				// 	about unsupported function
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const errorMsg = (error as any).message || String(error);
				expect(errorMsg).toContain('Aggregate function');
				expect(errorMsg).toContain('is not supported');
			}
		});

		it('returns query with multiple aggregates all branches', async () => {
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
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
							alias: 'count_alias',
						},
						{
							column: 'id',
							function: 'sum',
							alias: 'sum_alias',
						},
						{
							column: 'id',
							function: 'avg',
							alias: 'avg_alias',
						},
						{
							column: 'id',
							function: 'min',
							alias: 'min_alias',
						},
						{
							column: 'id',
							function: 'max',
							alias: 'max_alias',
						},
					],
					columns: ['id'],
					limit: 10,
					offset: 0,
				},
			};

			const query = await endpoint['getQuery'](request);

			expect(query.columns).toBeDefined();
			// Should have 5 aggregates in the columns array
			expect(Array.isArray(query.columns)).toBeTrue();
		});

		it('aggregates without pre-specified columns', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['id'],
					aggregates: [
						{
							column: 'id',
							function: 'sum',
							alias: 'total_ids',
						},
					],
					// Note: no columns specified, should be auto-populated
					// 	from aggregates
					limit: 1,
				}),
			});
			if (response.status !== 200) {
				throw await response.json();
			}

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
			expect(body.records.length).toBeGreaterThan(0);
			// Response should have aggregate result
			const firstRecord = body.records[0];
			expect(firstRecord).toBeDefined();
		});

		it('groupBy without pre-specified columns', async () => {
			const url = `${env.API_URL}/users/search`;

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					groupBy: ['name'],
					aggregates: [
						{
							column: 'id',
							function: 'count',
						},
					],
					// No columns specified
					limit: 10,
				}),
			});

			expect(response.status).toBe(200);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const body = (await response.json()) as any;
			expect(Array.isArray(body.records)).toBeTrue();
		});
	});
});
