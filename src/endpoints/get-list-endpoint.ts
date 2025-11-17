import { ApiNextFunction, ApiRequest, ApiResponse } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';

export class RiaoGetListEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/';

	override async handle(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		request: ApiRequest,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		response: ApiResponse,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		next: ApiNextFunction
	) {
		const records = await this.repo.find({});

		return records;
	}
}
