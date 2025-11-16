import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';

export class RiaoGetListEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/';

	override async handle() {
		const records = await this.repo.find({});

		return records;
	}
}
