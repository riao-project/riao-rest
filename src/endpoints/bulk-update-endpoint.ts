import {
	ApiNextFunction,
	ApiRequest,
	ApiResponse,
} from 'api-machine';
import { EndpointMethod } from 'api-machine/router/endpoint';
import { BulkUpdateRequest, BulkUpdateResponse } from '@riao/rest-contract';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint.js';

export class RiaoBulkUpdateEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/bulk-update';
	override method = EndpointMethod.POST;
	override statusCode = 200;

	public async handle(
		request: ApiRequest,
		_response: ApiResponse,
		_next: ApiNextFunction
	): Promise<BulkUpdateResponse> {
		const body = request.body as BulkUpdateRequest<T>;
		const items = body.items || [];

		let successCount = 0;
		let failureCount = 0;
		const failures: Array<{ id: string; error: string }> = [];

		for (const update of items) {
			try {
				await this.findOneOr404(update.id);
				await this.repo.update({
					where: <T>{ id: update.id },
					set: update as any,
				});
				successCount++;
			}
			catch (error: unknown) {
				failureCount++;
				failures.push({
					id: update.id,
					error: (error as Error).message || String(error),
				});
			}
		}

		return {
			successCount,
			failureCount,
			failures: failures.length ? failures : undefined,
		};
	}
}
