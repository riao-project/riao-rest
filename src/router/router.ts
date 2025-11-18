import { QueryRepository } from '@riao/dbal';
import { BaseApiRouter } from 'api-machine';
import { DatabaseRecordWithId } from '../endpoints';
import { BaseApiRoute } from 'api-machine/router/base';

export abstract class RiaoRouter<
	T extends DatabaseRecordWithId = DatabaseRecordWithId,
> extends BaseApiRouter {
	repo?: QueryRepository<T>;

	protected override async registerInstance(
		instance: BaseApiRoute
	): Promise<void> {
		await super.registerInstance(instance);
		Object.assign(instance, { repo: this.repo });
	}
}
