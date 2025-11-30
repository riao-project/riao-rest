import { RiaoGetListEndpoint } from '../../../src/endpoints';
import { maindb } from '../../../database/main';
import { RiaoSearchEndpoint } from '../../../src/endpoints/search-endpoint';
import { identifier } from '@riao/dbal/expression/identifier';

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
			id: { column: 'posts.id' },
			user_id: { column: 'posts.user_id' },
			title: { column: 'posts.title' },
			rating: { column: 'posts.rating' },
			created_at: { column: 'posts.created_at' },
			// User name join
			'users.name': {
				column: 'users.name',
				join: {
					table: 'users',
					on: {
						'posts.user_id': identifier('users.id'),
					},
				},
			},
		};
	}
}

export class SearchCommentsEndpoint extends RiaoSearchEndpoint<Comment> {
	override getColumnMap() {
		return {
			id: { column: 'comments.id' },
			post_id: { column: 'comments.post_id' },
			user_id: { column: 'comments.user_id' },
			content: { column: 'comments.content' },
			rating: { column: 'comments.rating' },
			created_at: { column: 'comments.created_at' },
			// Post title join
			'posts.title': {
				column: 'posts.title',
				join: {
					table: 'posts',
					on: {
						'comments.post_id': identifier('posts.id'),
					},
				},
			},
			// User name join
			'users.name': {
				column: 'users.name',
				join: {
					table: 'users',
					on: {
						'comments.user_id': identifier('users.id'),
					},
				},
			},
		};
	}
}
