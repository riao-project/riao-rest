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
	DatabaseFunctions,
	Expression,
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
import { DatabaseFunctionToken } from '@riao/dbal/functions/function-token';
import { identifier } from '@riao/dbal/expression/identifier';

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
		// TODO: value: new ComposedValSan([...]),
	},
	// TODO: Disable once there's value validation
	allowAdditionalProperties: true,
});

export const whereArrayValidator = new ArrayValSan({
	schema: whereConditionValidator,
});

export const aggregateColumnValidator = new ObjectValSan({
	schema: {
		column: columnNameValidator,
		function: new EnumValidator({
			allowedValues: ['count', 'sum', 'avg', 'min', 'max'],
		}),
		alias: columnNameValidator.copy({ isOptional: true }),
	},
});

export const aggregateArrayValidator = new ArrayValSan({
	schema: aggregateColumnValidator,
});

export const searchValidators = {
	...listValidators,
	columns: columnArrayValidator.copy({ isOptional: true }),
	where: whereArrayValidator.copy({ isOptional: true }),
	aggregates: aggregateArrayValidator.copy({ isOptional: true }),
	groupBy: columnArrayValidator.copy({ isOptional: true }),
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

export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface RiaoAggregateColumn {
	column: string;
	function: AggregateFunction;
	alias?: string;
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
			aggregates: searchValidators.aggregates,
			groupBy: searchValidators.groupBy,
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
		let columns = request.body['columns'] as string[] | undefined;
		const aggregates = request.body['aggregates'] as
			| RiaoAggregateColumn[]
			| undefined;
		const where = request.body['where'] as
			| RiaoSearchCondition[]
			| undefined;
		const groupBy = request.body['groupBy'] as string[] | undefined;
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

		const columnMap = this.getColumnMap();

		if (where !== undefined && where.length > 0) {
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

		const appendWhere = await this.appendWhere();
		if (appendWhere.length > 0) {
			if (!query.where) {
				query.where = [];
			}

			if ((query.where as Expression[]).length > 0) {
				(query.where as Expression[]).push(and);
			}

			(query.where as Expression[]).push(...appendWhere);
		}

		const selectColumns: Record<string, SelectColumn<T>> = {};

		if (aggregates !== undefined && aggregates.length > 0) {
			if (!groupBy || groupBy.length === 0) {
				throw new UnprocessableEntityError(
					'At least one groupBy column is required when ' +
						'using aggregates.'
				);
			}

			if (!columns) {
				columns = [];
			}

			for (const aggregate of aggregates) {
				const mappedColumn = columnMap[aggregate.column];
				if (!mappedColumn) {
					throw new UnprocessableEntityError(
						`Column "${aggregate.column}" is not a valid ` +
							'selectable column.'
					);
				}

				const key = aggregate.alias || aggregate.column;
				if (selectColumns[key]) {
					throw new UnprocessableEntityError(
						`Duplicate aggregate alias or column "${key}".`
					);
				}

				let dbfn: DatabaseFunctionToken;

				if (aggregate.function === 'count') {
					dbfn = DatabaseFunctions.count();
				}
				else if (aggregate.function === 'sum') {
					dbfn = DatabaseFunctions.sum(
						identifier(mappedColumn.column as string)
					);
				}
				else if (aggregate.function === 'avg') {
					dbfn = DatabaseFunctions.average(
						identifier(mappedColumn.column as string)
					);
				}
				else if (aggregate.function === 'min') {
					dbfn = DatabaseFunctions.min(
						identifier(mappedColumn.column as string)
					);
				}
				else if (aggregate.function === 'max') {
					dbfn = DatabaseFunctions.max(
						identifier(mappedColumn.column as string)
					);
				}
				else {
					throw new UnprocessableEntityError(
						`Aggregate function "${aggregate.function}" ` +
							'is not supported.'
					);
				}

				if (!columns.includes(aggregate.column)) {
					// TODO: This is added to include joins etc. -
					// 	but we don't really want to push the column
					// 	to the select
					columns.push(aggregate.column);
				}

				selectColumns[key] = {
					query: dbfn,
					as: key,
				};
			}
		}

		// Validate groupBy columns for security
		if (groupBy !== undefined && groupBy.length > 0) {
			if (!aggregates || aggregates.length === 0) {
				throw new UnprocessableEntityError(
					'At least one aggregate is required when using ' +
						'groupBy.'
				);
			}

			// istanbul ignore next
			if (!columns) {
				// TODO: This is added to include joins etc. - but we don't
				// 	really want to push the column to the select
				// 	when only grouping
				// istanbul ignore next
				columns = [];
			}

			if (!query.groupBy) {
				query.groupBy = [];
			}

			for (const col of groupBy) {
				const mappedColumn = columnMap[col];

				if (!mappedColumn) {
					throw new UnprocessableEntityError(
						`Column "${col}" is not a valid selectable column.`
					);
				}

				if (!columns.includes(col)) {
					columns.push(col);
				}

				query.groupBy.push(mappedColumn.column as string);
			}
		}

		const joins: Record<string, Join> = {};

		if (columns !== undefined && columns.length > 0) {
			for (const column of columns) {
				const selectColumn = columnMap[column as string];

				if (selectColumn) {
					if (!selectColumns[selectColumn.column as string]) {
						selectColumns[selectColumn.column as string] =
							selectColumn.column;
					}

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

			if (Object.keys(selectColumns).length > 0) {
				query.columns = Object.values(selectColumns);
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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected async appendWhere(): Promise<KeyValExpression<any>[]> {
		return [];
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
