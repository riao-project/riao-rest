import { ApiNextFunction, ApiRequest, ApiResponse } from 'api-machine';
import { EndpointMethod } from 'api-machine/router/endpoint';
import { BulkDeleteRequest, BulkDeleteResponse } from '@riao/rest-contract';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';

export class RiaoBulkDeleteEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/bulk-delete';
	override method = EndpointMethod.POST;
	override statusCode = 200;

	override async handle(
		request: ApiRequest,
		_response: ApiResponse,
		_next: ApiNextFunction
	): Promise<BulkDeleteResponse> {
		const body = request.body as BulkDeleteRequest;
		const ids = body.ids || [];

		let deletedCount = 0;
		let failureCount = 0;
		const failures: Array<{ id: string; error: string }> = [];

		for (const id of ids) {
			try {
				await this.findOneOr404(id);
				await this.repo.delete({
					where: <T>{ id: id },
				});
				deletedCount++;
			}
			catch (error: unknown) {
				failureCount++;
				failures.push({
					id: id,
					error: (error as Error).message || String(error),
				});
			}
		}

		return {
			deletedCount,
			failureCount,
			failures: failures.length ? failures : undefined,
		};
	}
}
