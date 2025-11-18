import { DatabaseRecord, QueryRepository } from '@riao/dbal';
import { BaseApiEndpoint, NotFoundError } from 'api-machine';

export type DatabaseRecordWithId = DatabaseRecord & { id: string };

export abstract class RiaoEndpoint<
	T extends DatabaseRecordWithId,
> extends BaseApiEndpoint {
	public repo: QueryRepository<T>;

	protected async findOneOr404(id: string): Promise<T> {
		const record = await this.repo.findOne({ where: <T>{ id: id } });

		if (!record) {
			throw new NotFoundError('Record not found');
		}

		return record;
	}
}
