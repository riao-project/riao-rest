import { RiaoGetListEndpoint } from '../../../src/endpoints';
import { maindb } from '../../../database/main';
import { RiaoSearchEndpoint } from '../../../src/endpoints/search-endpoint';

// Post model
export interface Post {
	id: string;
	user_id: string;
	title: string;
	rating: number;
	created_at: string;
}

// Comment model
export interface Comment {
	id: string;
	post_id: string;
	user_id: string;
	content: string;
	rating: number;
	created_at: string;
}

// Repositories
export const postsRepo = maindb.getQueryRepository<Post>({
	table: 'posts',
	identifiedBy: 'id',
});

export const commentsRepo = maindb.getQueryRepository<Comment>({
	table: 'comments',
	identifiedBy: 'id',
});

// List endpoints
export class ListPostsEndpoint extends RiaoGetListEndpoint<Post> {}

export class ListCommentsEndpoint extends RiaoGetListEndpoint<Comment> {}

// Search endpoints with column mappings for joins
export class SearchPostsEndpoint extends RiaoSearchEndpoint<Post> {
	override getColumnMap() {
		return {
			id: { column: 'id' },
			user_id: { column: 'user_id' },
			title: { column: 'title' },
			rating: { column: 'rating' },
			created_at: { column: 'created_at' },
			// User name join
			user_name: {
				column: 'users.name',
				join: {
					table: 'users',
					alias: 'users',
					on: {
						'posts.user_id': 'users.id',
					},
				},
			},
		};
	}
}

export class SearchCommentsEndpoint extends RiaoSearchEndpoint<Comment> {
	override getColumnMap() {
		return {
			id: { column: 'id' },
			post_id: { column: 'post_id' },
			user_id: { column: 'user_id' },
			content: { column: 'content' },
			rating: { column: 'rating' },
			created_at: { column: 'created_at' },
			// Post title join
			post_title: {
				column: 'posts.title',
				join: {
					table: 'posts',
					alias: 'posts',
					on: {
						'comments.post_id': 'posts.id',
					},
				},
			},
			// User name join
			user_name: {
				column: 'users.name',
				join: {
					table: 'users',
					alias: 'users',
					on: {
						'comments.user_id': 'users.id',
					},
				},
			},
		};
	}
}
