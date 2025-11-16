import { ApiRequest, NotFoundError } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';

export class RiaoGetOneEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/:id';

	override getErrors() {
		return {
			not_found: new NotFoundError('Record not found'),
		};
	}

	override async handle(request: ApiRequest) {
		const id = (request.params as { id: string }).id;
		const record = await this.findOneOr404(id);

		return record;
	}
}
