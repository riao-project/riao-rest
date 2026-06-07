import { QueryRepository } from '@riao/dbal';
import { BaseApiRouter } from 'api-machine';
import { DatabaseRecordWithId } from '../endpoints';

export abstract class RiaoRouter<
	T extends DatabaseRecordWithId = DatabaseRecordWithId,
> extends BaseApiRouter {
	repo?: QueryRepository<T>;

	public override inject(): void {
		super.inject();

		if (this.repo) {
			this.container.registerInstance('repo', this.repo);
		}
	}
}
