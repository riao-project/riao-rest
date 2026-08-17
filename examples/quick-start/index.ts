import { ApiRequest, ConflictError, RestServer } from 'api-machine';
import {
	RiaoCreateEndpoint,
	RiaoGetListEndpoint,
	RiaoGetOneEndpoint,
	RiaoUpdateEndpoint,
	RiaoDeleteEndpoint,
	RiaoBulkUpdateEndpoint,
	RiaoBulkDeleteEndpoint,
} from '../../src/endpoints';
import { ApiRoute } from 'api-machine/router/base';
import { maindb } from '../../database/main';
import {
	ComposedValSan,
	EmailValidator,
	LengthValidator,
	ObjectValSan,
	RangeValidator,
	TrimSanitizer,
} from 'valsan';
import { RiaoRouter } from '../../src/router';
import { RiaoSearchEndpoint } from '../../src/endpoints/search-endpoint';
import { identifier } from '@riao/dbal/expression/identifier';
import {
	ListPostsEndpoint,
	SearchPostsEndpoint,
	ListCommentsEndpoint,
	SearchCommentsEndpoint,
	postsRepo,
	commentsRepo,
	Post,
	Comment,
} from '../../test/spec/endpoints/search-aggregation.endpoints';
import { Join } from '@riao/dbal';

export interface User {
	id: string;
	name: string;
	email: string;
}

export const repo = maindb.getQueryRepository<User>({
	table: 'users',
	identifiedBy: 'id',
});

const idValidator = new RangeValidator({
	min: 1,
	max: Number.MAX_SAFE_INTEGER,
});

const emailValidator = new ComposedValSan([
	new TrimSanitizer(),
	new LengthValidator({ minLength: 10, maxLength: 100 }),
	new EmailValidator(),
]);

const nameValidator = new ComposedValSan([
	new TrimSanitizer(),
	new LengthValidator({ minLength: 1, maxLength: 100 }),
]);

class CreateUserEndpoint extends RiaoCreateEndpoint<User> {
	override description = 'Create a new user';

	override bodyExample = {
		name: 'John Doe',
		email: 'john.doe@example.com',
	};

	override body = new ObjectValSan({
		schema: {
			name: nameValidator,
			email: emailValidator,
		},
	});

	override getErrors() {
		return {
			...super.getErrors(),
			conflict: new ConflictError(
				'A user with this email already exists.'
			),
		};
	}

	override async checkConflict(request: ApiRequest): Promise<void> {
		const conflict = await repo.findOne({
			where: <User>{ email: request.body.email },
		});

		if (conflict) {
			throw this.getErrors().conflict;
		}
	}
}

class ListUsersEndpoint extends RiaoGetListEndpoint<User> {}

class SearchUsersEndpoint extends RiaoSearchEndpoint<User> {
	override getColumnMap() {
		return {
			id: { column: 'id' },
			name: { column: 'name' },
			email: { column: 'email' },
		};
	}
}

class SearchUsersWithPostsEndpoint extends RiaoSearchEndpoint<User> {
	override getColumnMap() {
		return {
			id: { column: 'users.id' },
			name: { column: 'users.name' },
			email: { column: 'users.email' },
			// Post title joined column
			post_title: {
				column: 'posts.title',
				join: <Join>{
					table: 'posts',
					type: 'LEFT',
					on: {
						'posts.user_id': identifier('users.id'),
					},
				},
			},
		};
	}
}

class GetUserEndpoint extends RiaoGetOneEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectValSan({
		schema: {
			id: idValidator,
		},
	});
}

class UpdateUserEndpoint extends RiaoUpdateEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectValSan({
		schema: {
			id: idValidator,
		},
	});

	override bodyExample = {
		name: 'Jane Doe',
		email: 'jane.doe@example.com',
	};

	override body = new ObjectValSan({
		schema: {
			name: nameValidator.copy({ isOptional: true }),
			email: emailValidator.copy({ isOptional: true }),
		},
	});
}

class DeleteUserEndpoint extends RiaoDeleteEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectValSan({
		schema: {
			id: idValidator,
		},
	});
}

class BulkUpdateUsersEndpoint extends RiaoBulkUpdateEndpoint<User> {}

class BulkDeleteUsersEndpoint extends RiaoBulkDeleteEndpoint<User> {}

class UsersRouter extends RiaoRouter<User> {
	override repo = repo;
	override path = '/users';

	protected override async routes(): Promise<ApiRoute[]> {
		return [
			CreateUserEndpoint,
			GetUserEndpoint,
			ListUsersEndpoint,
			SearchUsersEndpoint,
			UpdateUserEndpoint,
			DeleteUserEndpoint,
			BulkUpdateUsersEndpoint,
			BulkDeleteUsersEndpoint,
		];
	}
}

export class PostsRouter extends RiaoRouter<Post> {
	override repo = postsRepo;
	override path = '/posts';

	protected override async routes(): Promise<ApiRoute[]> {
		return [ListPostsEndpoint, SearchPostsEndpoint];
	}
}

export class CommentsRouter extends RiaoRouter<Comment> {
	override repo = commentsRepo;
	override path = '/comments';

	protected override async routes(): Promise<ApiRoute[]> {
		return [ListCommentsEndpoint, SearchCommentsEndpoint];
	}
}

class UsersWithPostsSearchRouter extends RiaoRouter<User> {
	override repo = repo;
	override path = '/users-with-posts-search';

	protected override async routes(): Promise<ApiRoute[]> {
		return [SearchUsersWithPostsEndpoint];
	}
}

class MainRouter extends RiaoRouter {
	protected override async routes(): Promise<ApiRoute[]> {
		return [
			UsersRouter,
			PostsRouter,
			CommentsRouter,
			UsersWithPostsSearchRouter,
		];
	}
}

export class Server extends RestServer {
	override router = MainRouter;
}
