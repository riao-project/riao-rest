import { ApiNextFunction, ApiRequest, ApiResponse } from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import {
	ComposedValSan,
	LengthValidator,
	ObjectSanitizer,
	PatternValidator,
	RangeValidator,
	StringToNumberValSan,
	UppercaseSanitizer,
} from 'valsan';

import { EnumValidator } from 'valsan/primitives/utility';
import { SelectQuery } from '@riao/dbal';

export const listValidators = {
	limit: new ComposedValSan(
		[new StringToNumberValSan(), new RangeValidator({ min: 1, max: 1000 })],
		{ isOptional: true }
	),
	offset: new ComposedValSan(
		[
			new StringToNumberValSan(),
			new RangeValidator({ min: 0, max: Number.MAX_SAFE_INTEGER }),
		],
		{ isOptional: true }
	),
	orderBy: new ComposedValSan(
		[
			new LengthValidator({ minLength: 1, maxLength: 255 }),
			new PatternValidator({ pattern: /^[a-zA-Z0-9_]+$/ }),
		],
		{ isOptional: true }
	),
	orderDirection: new ComposedValSan(
		[
			new LengthValidator({ minLength: 3, maxLength: 4 }),
			new UppercaseSanitizer(),
			new EnumValidator({ allowedValues: ['ASC', 'DESC'] }),
		],
		{ isOptional: true }
	),
};

export class RiaoGetListEndpoint<
	T extends DatabaseRecordWithId,
> extends RiaoEndpoint<T> {
	override path = '/';

	override queryExample = {
		limit: 100,
		offset: 0,
		orderBy: 'name',
		orderDirection: 'ASC',
	};

	override query = new ObjectSanitizer({
		limit: listValidators.limit,
		offset: listValidators.offset,
		orderBy: listValidators.orderBy,
		orderDirection: listValidators.orderDirection,
	});

	override async handle(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		request: ApiRequest,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		response: ApiResponse,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		next: ApiNextFunction
	) {
		const limit = request.query['limit'] as number | undefined;
		const offset = request.query['offset'] as number | undefined;
		const orderBy = request.query['orderBy'] as keyof T | undefined;
		const orderDirection = request.query['orderDirection'] as
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

		const records = await this.repo.find(query);

		return records;
	}
}
