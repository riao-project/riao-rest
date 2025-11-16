import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';
import { ErrorResponse, ApiRequest } from 'api-machine';

describe('CreateUserEndpoint (integration)', () => {
	it('creates a user via API and persists it in the database', async () => {
		const url = `${env.API_URL}/users`;
		const email = `test+${Date.now()}@example.com`;
		const name = 'Integration Test User';

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, email }),
		});

		expect(res.status).toBe(201);

		const body = (await res.json()) as User;
		expect(body).toBeDefined();
		expect(body.id).toBeDefined();

		// Confirm record exists in DB via repo
		const record = await repo.findOne({ where: <User>{ id: body.id } });
		expect(record).toBeDefined();
		expect(record && record.email).toBe(email);
		expect(record && record.name).toBe(name);
	});

	it('rejects invalid body and does not create a record', async () => {
		const url = `${env.API_URL}/users`;
		const email = 'not-an-email';
		const name = 'Bad User';

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, email }),
		});

		expect(res.status).toBe(422);

		const record = await repo.findOne({ where: <User>{ email } });
		expect(record).toBeNull();
	});

	it('rejects duplicate email and does not create a record', async () => {
		const url = `${env.API_URL}/users`;
		const email = `duplicate+${Date.now()}@example.com`;
		const name1 = 'First User';
		const name2 = 'Second User';

		// Create first user
		const res1 = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name1, email }),
		});
		expect(res1.status).toBe(201);

		// Attempt to create second user with same email
		const res2 = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name2, email }),
		});
		expect(res2.status).toBe(409);

		const body2 = (await res2.json()) as ErrorResponse;
		expect(Object.keys(body2)).toEqual([
			'error',
			'message',
			'timestamp',
			'options',
		]);

		expect(body2.error).toBe('ConflictError');
		expect(body2.message).toBe('A user with this email already exists.');
		expect(body2.options).toEqual({});
	});

	it('base checkConflict should not throw by default', async () => {
		const { RiaoCreateEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoCreateEndpoint<User>();
		const mockRequest = {} as ApiRequest;

		// Base implementation should not throw
		await expectAsync(endpoint.checkConflict(mockRequest)).toBeResolved();
	});

	it('should have correct endpoint configuration and getErrors', async () => {
		const { RiaoCreateEndpoint } = await import('../../../src/endpoints');
		const endpoint = new RiaoCreateEndpoint<User>();

		expect(endpoint.path).toBe('/');
		expect(endpoint.statusCode).toBe(201);
		expect(endpoint.getErrors().conflict).toBeDefined();
	});
});
