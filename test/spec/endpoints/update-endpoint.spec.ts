import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';
import { ApiRequest } from 'api-machine';

describe('UpdateUserEndpoint (integration)', () => {
	it('updates an existing user', async () => {
		const email = `update+${Date.now()}@example.com`;
		const name = 'Original Name';

		// Create a test user
		const created = await repo.insertOne({
			record: {
				name,
				email,
			},
		});

		const url = `${env.API_URL}/users/${created.id}`;
		const newName = 'Updated Name';
		const newEmail = `updated+${Date.now()}@example.com`;

		const res = await fetch(url, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName, email: newEmail }),
		});

		expect(res.status).toBe(204);

		// Confirm the update persisted in the database
		const record = await repo.findOne({
			where: <User>{ id: created.id },
		});
		expect(record).toBeDefined();
		expect(record && record.name).toBe(newName);
		expect(record && record.email).toBe(newEmail);
	});

	it('returns 404 when updating a non-existent user', async () => {
		const url = `${env.API_URL}/users/99999`;

		const res = await fetch(url, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Updated',
				email: 'updated@example.com',
			}),
		});

		expect(res.status).toBe(404);
	});

	it('rejects invalid body on update', async () => {
		const email = `updatebad+${Date.now()}@example.com`;

		// Create a test user
		const created = await repo.insertOne({
			record: {
				name: 'Test User',
				email,
			},
		});

		const url = `${env.API_URL}/users/${created.id}`;

		const res = await fetch(url, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Valid', email: 'invalid-email' }),
		});

		expect(res.status).toBe(422);
	});

	it('base checkConflict should not throw by default', async () => {
		const { RiaoUpdateEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoUpdateEndpoint<User>();
		const mockRequest = {} as ApiRequest;

		// Base implementation should not throw
		await expectAsync(endpoint.checkConflict(mockRequest)).toBeResolved();
	});

	it('should have correct endpoint configuration and getErrors', async () => {
		const { RiaoUpdateEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoUpdateEndpoint<User>();

		expect(endpoint.path).toBe('/:id');
		expect(endpoint.statusCode).toBe(204);
		expect(endpoint.getErrors().not_found).toBeDefined();
	});

	it('should not update fields with undefined values', async () => {
		const email = `updateundef+${Date.now()}@example.com`;
		const name = 'Original Name';
		const created = await repo.insertOne({
			record: {
				name,
				email,
			},
		});

		const url = `${env.API_URL}/users/${created.id}`;

		const res = await fetch(url, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Undefined Email' }),
		});

		expect(res.status).toBe(204);

		// Confirm the name was not updated (remains the same)
		const record = await repo.findOne({
			where: <User>{ id: created.id },
		});
		expect(record).toBeDefined();
		expect(record && record.name).toBe('Undefined Email');
		expect(record && record.email).toBe(email);
	});
});
