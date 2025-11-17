import { ApiRequest, ConflictError, RestServer } from 'api-machine';
import {
	RiaoCreateEndpoint,
	RiaoGetListEndpoint,
	RiaoGetOneEndpoint,
	RiaoUpdateEndpoint,
	RiaoDeleteEndpoint,
} from '../../src/endpoints';
import { ApiRoute } from 'api-machine/router/base';
import { maindb } from '../../database/main';
import {
	ComposedValSan,
	EmailValidator,
	LengthValidator,
	ObjectSanitizer,
	RangeValidator,
	TrimSanitizer,
} from 'valsan';
import { RiaoRouter } from '../../src/router';

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

	override body = new ObjectSanitizer({
		name: nameValidator,
		email: emailValidator,
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

class GetUserEndpoint extends RiaoGetOneEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectSanitizer({
		id: idValidator,
	});
}

class UpdateUserEndpoint extends RiaoUpdateEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectSanitizer({
		id: idValidator,
	});

	override bodyExample = {
		name: 'Jane Doe',
		email: 'jane.doe@example.com',
	};

	override body = new ObjectSanitizer({
		name: nameValidator.copy({ isOptional: true }),
		email: emailValidator.copy({ isOptional: true }),
	});
}

class DeleteUserEndpoint extends RiaoDeleteEndpoint<User> {
	override paramsExample = {
		id: '1',
	};

	override params = new ObjectSanitizer({
		id: idValidator,
	});
}

class UsersRouter extends RiaoRouter<User> {
	override repo = repo;
	override path = '/users';

	protected override async routes(): Promise<ApiRoute[]> {
		return [
			CreateUserEndpoint,
			GetUserEndpoint,
			ListUsersEndpoint,
			UpdateUserEndpoint,
			DeleteUserEndpoint,
		];
	}
}

export class Server extends RestServer {
	override router = UsersRouter;
}
