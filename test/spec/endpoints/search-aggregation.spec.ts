/**
 * Complex aggregation tests combining aggregations, groupBy, where, and joins
 * Tests real-world scenarios like:
 * - Average post rating for a specific user
 * - Count of comments per post
 * - Sum of ratings per user
 * - Grouped aggregations with filters
 */
import 'jasmine';
import { postsRepo, commentsRepo } from './search-aggregation.endpoints';
import { env } from '../../env';

describe('SearchEndpoint complex aggregation scenarios', () => {
	it('calculates average post rating for a specific user', async () => {
		// Use unique identifier for this test
		const testId = Date.now().toString();

		// Insert test data
		await postsRepo.insert({
			records: [
				{
					user_id: testId,
					title: 'Post 1',
					rating: 90,
				},
				{
					user_id: testId,
					title: 'Post 2',
					rating: 85,
				},
				{
					user_id: testId,
					title: 'Post 3',
					rating: 95,
				},
				{
					user_id: (Number(testId) + 1).toString(),
					title: 'Other Post',
					rating: 50,
				},
			],
		});

		const url = `${env.API_URL}/posts/search`;

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				// Filter for our test user
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: testId,
					},
				],
				// Get average rating
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		// Average of 90, 85, 95 = 90
		const firstRecord = body.records[0];
		expect(firstRecord)
			.withContext('first record should be defined')
			.toBeDefined();
		// Check that we the correct avg_rating field
		expect(firstRecord.avg_rating)
			.withContext('avg_rating field should equal 90')
			.toEqual(90);
	});

	it('counts comments per post and filters by post_id', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();
		const userId3 = (Number(testId) + 3).toString();

		// Insert posts
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 75,
			},
		});

		const post2 = await postsRepo.insertOne({
			record: {
				user_id: userId2,
				title: 'Post 2',
				rating: 80,
			},
		});

		// Retrieve posts for later use
		const [retrievedPost1, retrievedPost2] = [post1, post2];

		// Insert comments for post1
		await commentsRepo.insert({
			records: [
				{
					post_id: retrievedPost1.id,
					user_id: userId3,
					content: 'Comment 1',
					rating: 85,
				},
				{
					post_id: retrievedPost1.id,
					user_id: userId3,
					content: 'Comment 2',
					rating: 88,
				},
				{
					post_id: retrievedPost1.id,
					user_id: userId3,
					content: 'Comment 3',
					rating: 92,
				},
			],
		});

		// Insert comments for post2
		await commentsRepo.insert({
			records: [
				{
					post_id: retrievedPost2.id,
					user_id: userId3,
					content: 'Comment 4',
					rating: 70,
				},
				{
					post_id: retrievedPost2.id,
					user_id: userId3,
					content: 'Comment 5',
					rating: 75,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Count comments for post1
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'post_id',
						operator: '=',
						value: post1.id,
					},
				],
				groupBy: ['post_id'],
				aggregates: [
					{
						column: 'id',
						function: 'count',
						alias: 'comment_count',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		const firstRecord = body.records[0];
		expect(firstRecord.comment_count)
			.withContext('comment_count should be 3')
			.toBe(3);
	});

	it('groups comments by post_id with comment count', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();
		const userId3 = (Number(testId) + 3).toString();

		// Insert posts
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 90,
			},
		});

		const post2 = await postsRepo.insertOne({
			record: {
				user_id: userId2,
				title: 'Post 2',
				rating: 80,
			},
		});

		// Insert comments
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 1',
					rating: 85,
				},
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 2',
					rating: 88,
				},
				{
					post_id: post2.id,
					user_id: userId3,
					content: 'Comment 3',
					rating: 70,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Group by post_id and count comments
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				columns: ['post_id'],
				where: [
					{
						column: 'post_id',
						operator: 'INARRAY',
						value: [post1.id, post2.id],
					},
				],
				groupBy: ['post_id'],
				aggregates: [
					{
						column: 'id',
						function: 'count',
						alias: 'count_per_post',
					},
				],
				limit: 10,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };

		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();

		// Find the records for our specific test posts
		// Filter to only the posts created in this test
		const post1Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) => r.post_id === post1.id
		);
		const post2Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) => r.post_id === post2.id
		);

		expect(post1Record)
			.withContext('post1 record should be found')
			.toBeDefined();
		expect(post1Record.count_per_post)
			.withContext('post1 comment count should be 2')
			.toEqual(2);

		expect(post2Record)
			.withContext('post2 record should be found')
			.toBeDefined();
		expect(post2Record.count_per_post)
			.withContext('post2 comment count should be 1')
			.toEqual(1);
	});

	it('sums ratings for comments by user with filter', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();
		const userId3 = (Number(testId) + 3).toString();
		const userId4 = (Number(testId) + 4).toString();

		// Insert posts
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 90,
			},
		});

		const post2 = await postsRepo.insertOne({
			record: {
				user_id: userId2,
				title: 'Post 2',
				rating: 80,
			},
		});

		// Insert comments from user 3
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 1',
					rating: 85,
				},
				{
					post_id: post2.id,
					user_id: userId3,
					content: 'Comment 2',
					rating: 75,
				},
			],
		});

		// Insert comments from user 4
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId4,
					content: 'Comment 3',
					rating: 90,
				},
				{
					post_id: post2.id,
					user_id: userId4,
					content: 'Comment 4',
					rating: 95,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Sum ratings for user 3
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId3,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'sum',
						alias: 'total_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		// Sum of 85 + 75 = 160
		const firstRecord = body.records[0];
		expect(firstRecord.total_rating)
			.withContext('total_rating should be 160')
			.toBe(160);
	});

	it('finds min and max ratings per post', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId3 = (Number(testId) + 3).toString();
		const userId4 = (Number(testId) + 4).toString();
		const userId5 = (Number(testId) + 5).toString();

		// Insert post
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 90,
			},
		});

		// Insert comments with varying ratings
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 1',
					rating: 60,
				},
				{
					post_id: post1.id,
					user_id: userId4,
					content: 'Comment 2',
					rating: 95,
				},
				{
					post_id: post1.id,
					user_id: userId5,
					content: 'Comment 3',
					rating: 75,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Min and max ratings for post1
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'post_id',
						operator: '=',
						value: post1.id,
					},
				],
				groupBy: ['post_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'min',
						alias: 'min_rating',
					},
					{
						column: 'rating',
						function: 'max',
						alias: 'max_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };

		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		const firstRecord = body.records[0];
		// Should have min (60) and max (95)
		expect(firstRecord.min_rating)
			.withContext('min_rating should be 60')
			.toBe(60);
		expect(firstRecord.max_rating)
			.withContext('max_rating should be 95')
			.toBe(95);
	});

	it('groups posts by user_id with avg rating and count', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();

		// User 1 posts
		await postsRepo.insert({
			records: [
				{
					user_id: userId1,
					title: 'User 1 Post 1',
					rating: 80,
				},
				{
					user_id: userId1,
					title: 'User 1 Post 2',
					rating: 90,
				},
			],
		});

		// User 2 posts
		await postsRepo.insert({
			records: [
				{
					user_id: userId2,
					title: 'User 2 Post 1',
					rating: 70,
				},
			],
		});

		const url = `${env.API_URL}/posts/search`;

		// Query: Group by user_id, get count and avg rating
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				columns: ['user_id'],
				where: [
					// Filter to only include our test user IDs
					// 	to avoid collision with other tests
					{
						column: 'user_id',
						operator: 'INARRAY',
						value: [userId1, userId2],
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'id',
						function: 'count',
						alias: 'post_count',
					},
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_post_rating',
					},
				],
				limit: 10,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();

		// Find the records for our specific test users by
		// 	converting to string for comparison
		const user1Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) =>
				String(r.user_id) === userId1 || r.user_id === Number(userId1)
		);
		const user2Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) =>
				String(r.user_id) === userId2 || r.user_id === Number(userId2)
		);

		expect(user1Record)
			.withContext('user1 record should be found')
			.toBeDefined();
		expect(user1Record.post_count)
			.withContext('user1 post count should be 2')
			.toEqual(2);
		expect(user1Record.avg_post_rating)
			.withContext('user1 avg post rating should be 85')
			.toEqual(85);

		expect(user2Record)
			.withContext('user2 record should be found')
			.toBeDefined();
		expect(user2Record.post_count)
			.withContext('user2 post count should be 1')
			.toEqual(1);
		expect(user2Record.avg_post_rating)
			.withContext('user2 avg post rating should be 70')
			.toEqual(70);
	});

	it('can avg comment rating by user with rating filter', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId3 = (Number(testId) + 3).toString();

		// Insert posts
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 90,
			},
		});

		// Insert multiple comments from user 3 with varying ratings
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 1',
					rating: 50,
				},
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 2',
					rating: 95,
				},
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 3',
					rating: 30,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: User 3's comments with rating >= 50, get average
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId3,
					},
					{
						column: 'rating',
						operator: '>=',
						value: 50,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating_filtered',
					},
					{
						column: 'id',
						function: 'count',
						alias: 'count_matching',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		// Average of 50 and 90 = 72.5, count_matching = 2
		const firstRecord = body.records[0];
		expect(firstRecord.count_matching)
			.withContext('count_matching should equal 2')
			.toEqual(2);
		expect(firstRecord.avg_rating_filtered)
			.withContext('rating (avg) should equal 72.5')
			.toEqual(72.5);
	});

	it('all aggregations combined: count, sum, avg, min, max', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();
		const userId3 = (Number(testId) + 3).toString();
		const userId4 = (Number(testId) + 4).toString();

		// Insert post
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 90,
			},
		});

		// Insert comments
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId2,
					content: 'Comment 1',
					rating: 70,
				},
				{
					post_id: post1.id,
					user_id: userId3,
					content: 'Comment 2',
					rating: 80,
				},
				{
					post_id: post1.id,
					user_id: userId4,
					content: 'Comment 3',
					rating: 90,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: All 5 aggregates
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'post_id',
						operator: '=',
						value: post1.id,
					},
				],
				groupBy: ['post_id'],
				aggregates: [
					{
						column: 'id',
						function: 'count',
						alias: 'total_comments',
					},
					{
						column: 'rating',
						function: 'sum',
						alias: 'sum_ratings',
					},
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating',
					},
					{
						column: 'rating',
						function: 'min',
						alias: 'min_rating',
					},
					{
						column: 'rating',
						function: 'max',
						alias: 'max_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };

		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('body.records length should be 1')
			.toBe(1);

		const firstRecord = body.records[0];

		// Verify all aggregates are present and correct
		expect(firstRecord.total_comments)
			.withContext('total_comments count should be 3')
			.toBe(3);
		expect(firstRecord.sum_ratings)
			.withContext('sum_ratings should be 240 (70+80+90)')
			.toBe(240);
		expect(firstRecord.avg_rating)
			.withContext('avg_rating should be 80 (240/3)')
			.toBe(80);
		expect(firstRecord.min_rating)
			.withContext('min_rating should be 70')
			.toBe(70);
		expect(firstRecord.max_rating)
			.withContext('max_rating should be 90')
			.toBe(90);
	});

	it('handles aggregates when columns are already specified', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();

		// Insert post (needed to have data for aggregation)
		await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 75,
			},
		});

		const url = `${env.API_URL}/posts/search`;

		// Query: Request specific columns AND aggregates
		// This tests the code path where columns are already set
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				columns: ['id', 'title'],
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId1,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'sum',
						alias: 'total_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('should have one record')
			.toBe(1);

		const record = body.records[0];
		expect(record.total_rating)
			.withContext('total_rating should be 75')
			.toBe(75);
	});

	it('aggregates work with multiple aggregates on same column', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();

		// Insert post
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 88,
			},
		});

		// Insert comments with various ratings
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId1,
					content: 'Comment 1',
					rating: 50,
				},
				{
					post_id: post1.id,
					user_id: userId1,
					content: 'Comment 2',
					rating: 100,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Multiple aggregates on same column (rating)
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId1,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'min',
						alias: 'lowest',
					},
					{
						column: 'rating',
						function: 'max',
						alias: 'highest',
					},
					{
						column: 'rating',
						function: 'avg',
						alias: 'average',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();

		const record = body.records[0];
		expect(record.lowest)
			.withContext('lowest rating should be 50')
			.toBe(50);
		expect(record.highest)
			.withContext('highest rating should be 100')
			.toBe(100);
		expect(record.average).withContext('average should be 75').toBe(75);
	});

	it('can groupBy with count aggregate on different columns', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();
		const userId2 = (Number(testId) + 2).toString();

		// Insert posts
		const post1 = await postsRepo.insertOne({
			record: {
				user_id: userId1,
				title: 'Post 1',
				rating: 70,
			},
		});

		const post2 = await postsRepo.insertOne({
			record: {
				user_id: userId2,
				title: 'Post 2',
				rating: 80,
			},
		});

		// Insert comments
		await commentsRepo.insert({
			records: [
				{
					post_id: post1.id,
					user_id: userId1,
					content: 'Comment 1',
					rating: 60,
				},
				{
					post_id: post1.id,
					user_id: userId1,
					content: 'Comment 2',
					rating: 65,
				},
				{
					post_id: post2.id,
					user_id: userId2,
					content: 'Comment 3',
					rating: 90,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Count aggregates with different column targets
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				columns: ['user_id'],
				where: [
					{
						column: 'user_id',
						operator: 'INARRAY',
						value: [userId1, userId2],
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'id',
						function: 'count',
						alias: 'comment_count',
					},
					{
						column: 'post_id',
						function: 'count',
						alias: 'post_ref_count',
					},
				],
				limit: 10,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();

		// Find user1 and user2 records
		const user1Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) =>
				String(r.user_id) === userId1 || r.user_id === Number(userId1)
		);
		const user2Record = body.records.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(r: any) =>
				String(r.user_id) === userId2 || r.user_id === Number(userId2)
		);

		expect(user1Record)
			.withContext('user1 record should exist')
			.toBeDefined();
		expect(user1Record.comment_count)
			.withContext('user1 comment count should be 2')
			.toBe(2);
		expect(user1Record.post_ref_count)
			.withContext('user1 post ref count should be 2')
			.toBe(2);

		expect(user2Record)
			.withContext('user2 record should exist')
			.toBeDefined();
		expect(user2Record.comment_count)
			.withContext('user2 comment count should be 1')
			.toBe(1);
		expect(user2Record.post_ref_count)
			.withContext('user2 post ref count should be 1')
			.toBe(1);
	});

	it('search with columns specified alongside aggregates', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();

		// Insert posts
		await postsRepo.insert({
			records: [
				{
					user_id: userId1,
					title: 'Post A',
					rating: 60,
				},
				{
					user_id: userId1,
					title: 'Post B',
					rating: 70,
				},
				{
					user_id: userId1,
					title: 'Post C',
					rating: 80,
				},
			],
		});

		const url = `${env.API_URL}/posts/search`;

		// Query: Columns + aggregates + where + groupBy
		// This tests the code path where columns.includes()
		// 	might prevent duplicates
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				columns: ['user_id', 'title'],
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId1,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating',
					},
					{
						column: 'id',
						function: 'count',
						alias: 'post_count',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();
		expect(body.records.length)
			.withContext('should have exactly one group')
			.toBe(1);

		const record = body.records[0];
		expect(record.user_id).withContext('should have user_id').toBeDefined();
		expect(record.avg_rating)
			.withContext('avg_rating should be 70 (60+70+80)/3')
			.toEqual(70);
		expect(record.post_count)
			.withContext('post_count should be 3')
			.toEqual(3);
	});

	it('handles where conditions on aggregated group-by columns', async () => {
		// Use unique identifiers for this test
		const testId = Date.now().toString();
		const userId1 = (Number(testId) + 1).toString();

		// Insert comments
		await commentsRepo.insert({
			records: [
				{
					post_id: '1',
					user_id: userId1,
					content: 'Comment 1',
					rating: 40,
				},
				{
					post_id: '1',
					user_id: userId1,
					content: 'Comment 2',
					rating: 50,
				},
				{
					post_id: '1',
					user_id: userId1,
					content: 'Comment 3',
					rating: 60,
				},
			],
		});

		const url = `${env.API_URL}/comments/search`;

		// Query: Filter on user_id which is also the groupBy column
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				where: [
					{
						column: 'user_id',
						operator: '=',
						value: userId1,
					},
					{
						column: 'rating',
						operator: '>=',
						value: 45,
					},
				],
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'sum',
						alias: 'total_rating',
					},
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating',
					},
				],
				limit: 1,
			}),
		});

		if (response.status !== 200) {
			const errorBody = await response.json();

			throw errorBody;
		}

		expect(response.status)
			.withContext('response status should be 200')
			.toBe(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { records: any[] };
		expect(Array.isArray(body.records))
			.withContext('body.records should be an array')
			.toBeTrue();

		const record = body.records[0];
		// Ratings >= 45: 50 + 60 = 110, avg = 55
		expect(record.total_rating)
			.withContext('total_rating should be 110 (50+60)')
			.toEqual(110);
		expect(record.avg_rating)
			.withContext('avg_rating should be 55')
			.toEqual(55);
	});

	it('requires groupBy when aggregates are present', async () => {
		const url = `${env.API_URL}/posts/search`;

		// Query: Aggregates without groupBy
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				aggregates: [
					{
						column: 'rating',
						function: 'avg',
						alias: 'avg_rating',
					},
				],
				limit: 1,
			}),
		});

		expect(response.status)
			.withContext('response status should be 422')
			.toBe(422);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { message: string };

		expect(body.message).toEqual(
			'At least one groupBy column is required when using aggregates.'
		);
	});

	it('requires aggregates when groupBy is present', async () => {
		const url = `${env.API_URL}/posts/search`;

		// Query: groupBy without aggregates
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				groupBy: ['user_id'],
				limit: 1,
			}),
		});

		expect(response.status)
			.withContext('response status should be 422')
			.toBe(422);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { message: string };

		expect(body.message).toEqual(
			'At least one aggregate is required when using groupBy.'
		);
	});

	it('throws an error if two aggregates have the same alias', async () => {
		const url = `${env.API_URL}/posts/search`;

		// Query: Duplicate aggregate aliases
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				groupBy: ['user_id'],
				aggregates: [
					{
						column: 'rating',
						function: 'avg',
						alias: 'duplicate_alias',
					},
					{
						column: 'id',
						function: 'count',
						alias: 'duplicate_alias',
					},
				],
				limit: 1,
			}),
		});

		expect(response.status)
			.withContext('response status should be 422')
			.toBe(422);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body = (await response.json()) as { message: string };

		expect(body.message).toEqual(
			'Duplicate aggregate alias or column "duplicate_alias".'
		);
	});
});
