import { ApiRequest, NotFoundError } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import { EndpointMethod } from 'api-machine/router/endpoint';

export class RiaoDeleteEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/:id';
	override method = EndpointMethod.DELETE;
	override statusCode = 204;

	override getErrors() {
		return {
			not_found: new NotFoundError('Record not found'),
		};
	}

	override async handle(request: ApiRequest) {
		const id = (request.params as { id: string }).id;

		await this.findOneOr404(id);

		await this.repo.delete({
			where: <T>{ id: id },
		});

		return {};
	}
}
