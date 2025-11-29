import { ApiNextFunction, ApiRequest, ApiResponse } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import {
	ArrayValSan,
	ComposedValSan,
	ObjectValSan,
	StringToNumberValSan,
} from 'valsan';

import { SelectQuery } from '@riao/dbal';
import { listValidators } from './get-list-endpoint';
import { EndpointMethod } from 'api-machine/router/endpoint';

export const searchValidators = {
	...listValidators,
};

export class RiaoSearchEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/search';
	override method = EndpointMethod.POST;
	override statusCode: number = 200;

	override bodyExample = {
		limit: 100,
		offset: 0,
		orderBy: 'id',
		orderDirection: 'DESC',
	};

	override body = new ObjectValSan({
		schema: {
			limit: listValidators.limit,
			offset: listValidators.offset,
			orderBy: listValidators.orderBy,
			orderDirection: listValidators.orderDirection,
		},
	});

	override responseExample = {
		records: [{ id: 1, name: 'Example', email: 'example@example.com' }],
		count: 148,
	};

	override response = new ObjectValSan({
		schema: {
			records: new ArrayValSan({
				schema: new ObjectValSan({
					schema: {},
					allowAdditionalProperties: true,
				}),
			}),
			count: new ComposedValSan([new StringToNumberValSan()]),
		},
	});

	protected async getQuery(request: ApiRequest): Promise<SelectQuery<T>> {
		const limit = request.body['limit'] as number | undefined;
		const offset = request.body['offset'] as number | undefined;
		const orderBy = request.body['orderBy'] as keyof T | undefined;
		const orderDirection = request.body['orderDirection'] as
			| 'ASC'
			| 'DESC'
			| undefined;

		const query: SelectQuery<T> = {
			limit: limit || 1000,
			offset: offset || 0,
		};

		if (orderBy !== undefined && orderDirection !== undefined) {
			query.orderBy = { [orderBy]: orderDirection } as Partial<
				Record<keyof T, 'ASC' | 'DESC'>
			>;
		}

		return query;
	}

	override async handle(
		request: ApiRequest,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		response: ApiResponse,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		next: ApiNextFunction
	) {
		const query = await this.getQuery(request);

		const [records, count] = await Promise.all([
			this.repo.find(query),
			this.repo.count(),
		]);

		return {
			records,
			count,
		};
	}
}
