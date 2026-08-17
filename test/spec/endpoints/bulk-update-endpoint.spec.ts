import 'jasmine';
import { env } from '../../env';
import { repo, User } from '../../../examples/quick-start';

describe('BulkUpdateUserEndpoint (integration)', () => {
	it('updates multiple existing users', async () => {
		const name1 = 'Original Name 1';
		const email1 = `bulk-update-1+${Date.now()}@example.com`;
		const name2 = 'Original Name 2';
		const email2 = `bulk-update-2+${Date.now()}@example.com`;

		// Create test users
		const user1 = await repo.insertOne({
			record: { name: name1, email: email1 },
		});
		const user2 = await repo.insertOne({
			record: { name: name2, email: email2 },
		});

		const url = `${env.API_URL}/users/bulk-update`;
		
		const newName1 = 'Updated Name 1';
		const newName2 = 'Updated Name 2';

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [
					{ id: user1.id, name: newName1 },
					{ id: user2.id, name: newName2 },
				],
			}),
		});

		expect(res.status).toBe(200);
		
		const body = (await res.json()) as any;
		expect(body.successCount).toBe(2);
		expect(body.failureCount).toBe(0);
		expect(body.failures).toBeUndefined();

		// Confirm the update persisted in the database
		const record1 = await repo.findOne({ where: <User>{ id: user1.id } });
		expect(record1?.name).toBe(newName1);
		
		const record2 = await repo.findOne({ where: <User>{ id: user2.id } });
		expect(record2?.name).toBe(newName2);
	});

	it('handles partial failures when updating a non-existent user', async () => {
		const name = 'Original Name Partial';
		const email = `bulk-update-partial+${Date.now()}@example.com`;

		// Create a test user
		const user1 = await repo.insertOne({
			record: { name: name, email: email },
		});

		const url = `${env.API_URL}/users/bulk-update`;

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [
					{ id: user1.id, name: 'Updated Partial Name' },
					{ id: '99999', name: 'Non Existent' },
				],
			}),
		});

		expect(res.status).toBe(200);

		const body = (await res.json()) as any;
		expect(body.successCount).toBe(1);
		expect(body.failureCount).toBe(1);
		expect(body.failures).toBeDefined();
		expect(body.failures.length).toBe(1);
		expect(body.failures[0].id).toBe('99999');
	});
});
