import {
	ApiNextFunction,
	ApiRequest,
	ApiResponse,
	UnprocessableEntityError,
} from 'api-machine';
import { RiaoEndpoint, DatabaseRecordWithId } from './base-endpoint';
import {
	ArrayValSan,
	ComposedValSan,
	EnumValidator,
	LengthValidator,
	ObjectValSan,
	PatternValidator,
	StringToNumberValSan,
} from 'valsan';

import {
	and,
	gt,
	gte,
	inArray,
	Join,
	like,
	lt,
	lte,
	SelectColumn,
	SelectQuery,
} from '@riao/dbal';
import { listValidators } from './get-list-endpoint';
import { EndpointMethod } from 'api-machine/router/endpoint';
import { KeyValExpression } from '@riao/dbal/expression/key-val-expression';

export const columnNameValidator = new ComposedValSan([
	new LengthValidator({ minLength: 1, maxLength: 255 }),
	new PatternValidator({ pattern: /^[a-zA-Z0-9_.]+$/ }),
]);

export const columnArrayValidator = new ArrayValSan({
	schema: columnNameValidator,
});

export const whereConditionValidator = new ObjectValSan({
	schema: {
		column: columnNameValidator,
		operator: new EnumValidator({
			allowedValues: ['=', '<', '<=', '>', '>=', 'LIKE', 'INARRAY'],
		}),
		value: new LengthValidator({ minLength: 0, maxLength: 1024 }),
	},
});

export const whereArrayValidator = new ArrayValSan({
	schema: whereConditionValidator,
});

export const searchValidators = {
	...listValidators,
	columns: columnArrayValidator.copy({ isOptional: true }),
	where: whereArrayValidator.copy({ isOptional: true }),
};

export interface RiaoSearchColumn<T extends DatabaseRecordWithId> {
	column: SelectColumn<T> | string;
	join?: Join;
}

export interface RiaoSearchCondition {
	column: string;
	operator: '=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'INARRAY';
	value: string | number | boolean | null;
}

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
			columns: searchValidators.columns,
			where: searchValidators.where,
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

	protected getColumnMap(): Record<string, RiaoSearchColumn<T>> {
		return {};
	}

	protected async getQuery(request: ApiRequest): Promise<SelectQuery<T>> {
		let columns = request.body['columns'] as (keyof T)[] | undefined;
		const where = request.body['where'] as
			| RiaoSearchCondition[]
			| undefined;
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

		if (where !== undefined && where.length > 0) {
			const columnMap = this.getColumnMap();

			if (!columns) {
				columns = [];
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			query.where = [] as KeyValExpression<any>[];

			for (const condition of where) {
				if (!columns.includes(condition.column)) {
					columns.push(condition.column);
				}

				if (query.where.length) {
					query.where.push(and);
				}

				const mappedColumn = columnMap[condition.column];

				if (!mappedColumn) {
					throw new UnprocessableEntityError(
						`Column "${condition.column}" is not a valid ` +
							'filterable column.'
					);
				}

				if (typeof mappedColumn.column !== 'string') {
					throw new UnprocessableEntityError(
						`Column "${condition.column}" is not a valid ` +
							'filterable column.'
					);
				}

				if (condition.operator === '<') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: lt(condition.value),
					});
				}
				else if (condition.operator === '<=') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: lte(condition.value),
					});
				}
				else if (condition.operator === '=') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: condition.value,
					});
				}
				else if (condition.operator === '>') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: gt(condition.value),
					});
				}
				else if (condition.operator === '>=') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: gte(condition.value),
					});
				}
				else if (condition.operator === 'LIKE') {
					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: like(condition.value as string),
					});
				}
				else if (condition.operator === 'INARRAY') {
					// Parse comma-separated values or array of values
					const values = Array.isArray(condition.value)
						? condition.value
						: String(condition.value)
							.split(',')
							.map((v) => v.trim());

					query.where.push(<KeyValExpression<T>>{
						[mappedColumn.column]: inArray(values),
					});
				}
			}
		}

		const joins: Record<string, Join> = {};

		if (columns !== undefined && columns.length > 0) {
			const selectColumns: SelectColumn<T>[] = [];
			const columnMap = this.getColumnMap();

			for (const column of columns) {
				const selectColumn = columnMap[column as string];

				if (selectColumn) {
					selectColumns.push(selectColumn.column);

					if (selectColumn.join) {
						joins[
							selectColumn.join.alias || selectColumn.join.table
						] = selectColumn.join;
					}
				}
				else {
					throw new UnprocessableEntityError(
						`Column "${String(column)}" is not a valid ` +
							'selectable column.'
					);
				}
			}

			if (selectColumns.length > 0) {
				query.columns = selectColumns;
			}

			if (Object.keys(joins).length > 0) {
				query.join = Object.values(joins);
			}
		}

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
