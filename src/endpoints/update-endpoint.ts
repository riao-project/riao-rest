import { ApiRequest, NotFoundError } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import { EndpointMethod } from 'api-machine/router/endpoint';

export class RiaoUpdateEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/:id';
	override method = EndpointMethod.PATCH;
	override statusCode = 204;

	override getErrors() {
		return {
			not_found: new NotFoundError('Record not found'),
		};
	}

	override async handle(request: ApiRequest) {
		const id = (request.params as { id: string }).id;
		const updateData = request.body as Partial<T>;

		// Remove undefined values from updateData
		Object.keys(updateData).forEach((key) => {
			if (updateData[key as keyof T] === undefined) {
				delete updateData[key as keyof T];
			}
		});

		await this.findOneOr404(id);

		await this.repo.update({
			where: <T>{ id: id },
			set: updateData,
		});

		return {};
	}

	override async checkRequest(request: ApiRequest): Promise<void> {
		await super.checkRequest(request);
		await this.checkConflict(request);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async checkConflict(request: ApiRequest): Promise<void> {}
}
