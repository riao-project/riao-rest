import { QueryRepository } from '@riao/dbal';
import { BaseApiEndpoint, NotFoundError } from 'api-machine';
import { DatabaseRecordWithId } from '@riao/rest-contract';

export { DatabaseRecordWithId };

export abstract class RiaoEndpoint<
	T extends DatabaseRecordWithId,
> extends BaseApiEndpoint {
	public repo!: QueryRepository<T>;

	public override inject(): void {
		super.inject();
		this.repo = this.container.require<QueryRepository<T>>('repo');
	}

	protected async findOneOr404(id: string): Promise<T> {
		const record = await this.repo.findOne({ where: <T>{ id: id } });

		if (!record) {
			throw new NotFoundError('Record not found');
		}

		return record;
	}
}
