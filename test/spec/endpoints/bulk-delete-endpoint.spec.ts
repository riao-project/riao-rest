import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('BulkDeleteUserEndpoint (integration)', () => {
	it('deletes multiple existing users', async () => {
		const name1 = 'Delete Name 1';
		const email1 = `bulk-delete-1+${Date.now()}@example.com`;
		const name2 = 'Delete Name 2';
		const email2 = `bulk-delete-2+${Date.now()}@example.com`;

		// Create test users
		const user1 = await repo.insertOne({
			record: { name: name1, email: email1 },
		});
		const user2 = await repo.insertOne({
			record: { name: name2, email: email2 },
		});

		const url = `${env.API_URL}/users/bulk-delete`;

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ids: [user1.id, user2.id],
			}),
		});

		expect(res.status).toBe(200);
		
		const body = (await res.json()) as any;
		expect(body.deletedCount).toBe(2);
		expect(body.failureCount).toBe(0);
		expect(body.failures).toBeUndefined();

		// Confirm the deletes persisted in the database
		const record1 = await repo.findOne({ where: <User>{ id: user1.id } });
		expect(record1).toBeNull();
		
		const record2 = await repo.findOne({ where: <User>{ id: user2.id } });
		expect(record2).toBeNull();
	});

	it('handles partial failures when deleting a non-existent user', async () => {
		const name = 'Delete Name Partial';
		const email = `bulk-delete-partial+${Date.now()}@example.com`;

		// Create a test user
		const user1 = await repo.insertOne({
			record: { name: name, email: email },
		});

		const url = `${env.API_URL}/users/bulk-delete`;

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ids: [user1.id, '99999'],
			}),
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as any;
		expect(body.deletedCount).toBe(1);
		expect(body.failureCount).toBe(1);
		expect(body.failures).toBeDefined();
		expect(body.failures.length).toBe(1);
		expect(body.failures[0].id).toBe('99999');
	});
});
