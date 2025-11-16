import { ApiRequest, ConflictError } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import { EndpointMethod } from 'api-machine/router/endpoint';

export class RiaoCreateEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/';
	override method = EndpointMethod.POST;
	override statusCode = 201;

	override getErrors() {
		return {
			...super.getErrors(),
			conflict: new ConflictError(),
		};
	}

	override async handle(request: ApiRequest) {
		const result = await this.repo.insertOne({
			record: request.body as T,
		});

		return result;
	}

	override async checkRequest(request: ApiRequest): Promise<void> {
		await super.checkRequest(request);
		await this.checkConflict(request);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async checkConflict(request: ApiRequest): Promise<void> {}
}
