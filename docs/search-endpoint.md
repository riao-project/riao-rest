# Search Endpoint Guide

The `RiaoSearchEndpoint` provides powerful query capabilities for searching, filtering, and aggregating data from your database. It supports advanced features like column selection, conditional filtering, aggregations, and sorting.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Request Body](#request-body)
- [Columns Parameter](#columns-parameter)
- [Where Parameter](#where-parameter)
- [Aggregates Parameter](#aggregates-parameter)
- [Group By Parameter](#group-by-parameter)
- [Ordering Parameter](#ordering-parameter)
- [Pagination](#pagination)
- [Column Mapping](#column-mapping)
- [Response Format](#response-format)
- [Complete Examples](#complete-examples)

## Basic Setup

To create a search endpoint for your model, extend `RiaoSearchEndpoint`:

```typescript
import { RiaoSearchEndpoint } from '@riao/rest';

class UserSearchEndpoint extends RiaoSearchEndpoint<User> {
	protected override getColumnMap() {
		return {
			id: { column: 'users.id' },
			name: { column: 'users.name' },
			email: { column: 'users.email' },
			createdAt: { column: 'users.created_at' },
		};
	}
}
```

## Request Body

The search endpoint accepts POST requests with the following structure:

```json
{
	"columns": ["id", "name", "email"],
	"where": [
		{
			"column": "email",
			"operator": "LIKE",
			"value": "%@example.com"
		}
	],
	"aggregates": [
		{
			"column": "id",
			"function": "count",
			"alias": "total_users"
		}
	],
	"groupBy": ["email"],
	"orderBy": "id",
	"orderDirection": "DESC",
	"limit": 50,
	"offset": 0
}
```

All parameters are optional. If not provided, defaults will be applied.

## Columns Parameter

The `columns` parameter specifies which columns to retrieve in the response.

**Type:** `string[]`	
**Optional:** Yes	
**Default:** All columns if not specified with aggregates, otherwise only aggregated columns

### Example

```json
{
	"columns": ["id", "name", "email"]
}
```

This returns only the specified columns for each record. Columns must be defined in your endpoint's `getColumnMap()`.

## Where Parameter

The `where` parameter defines filter conditions to retrieve records matching specific criteria.

**Type:** `RiaoSearchCondition[]`

Each condition has:
- `column` (string, required): Column name from your column map
- `operator` (string, required): One of `=`, `<`, `<=`, `>`, `>=`, `LIKE`, `INARRAY`, `BETWEEN`
- `value` (string|number|boolean|null, required): The value to compare
- `minValue` (string|number, optional): For `BETWEEN` operator, minimum value
- `maxValue` (string|number, optional): For `BETWEEN` operator, maximum value

### Supported Operators

#### Equality (`=`)
Exact match comparison.

```json
{
	"column": "status",
	"operator": "=",
	"value": "active"
}
```

#### Comparison (`<`, `<=`, `>`, `>=`)
Numeric or date comparisons.

```json
[
	{
		"column": "age",
		"operator": ">=",
		"value": 18
	},
	{
		"column": "createdAt",
		"operator": ">",
		"value": "2024-01-01"
	}
]
```

#### Pattern Matching (`LIKE`)
Partial string matching using SQL LIKE syntax. Use `%` as wildcard.

```json
{
	"column": "email",
	"operator": "LIKE",
	"value": "%@example.com"
}
```

#### Array Matching (`INARRAY`)
Check if value is in a list of values. Can pass comma-separated string or array.

```json
{
	"column": "status",
	"operator": "INARRAY",
	"value": "active,pending,pending_review"
}
```

Or:

```json
{
	"column": "status",
	"operator": "INARRAY",
	"value": ["active", "pending"]
}
```

#### Range Matching (`BETWEEN`)
Find values within a range (inclusive).

```json
{
	"column": "price",
	"operator": "BETWEEN",
	"value": null,
	"minValue": 10.99,
	"maxValue": 99.99
}
```

### Multiple Conditions

Multiple where conditions are combined with `AND` logic:

```json
{
	"where": [
		{
			"column": "status",
			"operator": "=",
			"value": "active"
		},
		{
			"column": "age",
			"operator": ">=",
			"value": 18
		},
		{
			"column": "email",
			"operator": "LIKE",
			"value": "%@example.com"
		}
	]
}
```

This returns records where status=active AND age>=18 AND email LIKE %@example.com

## Aggregates Parameter

The `aggregates` parameter enables aggregation functions on columns, useful for summarization and analytics.

**Type:** `RiaoAggregateColumn[]`

Each aggregate has:
- `column` (string, required): Column to aggregate
- `function` (string, required): One of `count`, `sum`, `avg`, `min`, `max`
- `alias` (string, optional): Custom name for the result column

**Important:** When using aggregates, you must also specify `groupBy` with at least one column.

### Supported Functions

#### Count (`count`)
Count the number of records or non-null values.

```json
{
	"column": "id",
	"function": "count",
	"alias": "total_records"
}
```

#### Sum (`sum`)
Sum numeric values.

```json
{
	"column": "price",
	"function": "sum",
	"alias": "total_price"
}
```

#### Average (`avg`)
Calculate the average of numeric values.

```json
{
	"column": "price",
	"function": "avg",
	"alias": "avg_price"
}
```

#### Minimum (`min`)
Find the minimum value.

```json
{
	"column": "price",
	"function": "min",
	"alias": "min_price"
}
```

#### Maximum (`max`)
Find the maximum value.

```json
{
	"column": "price",
	"function": "max",
	"alias": "max_price"
}
```

### Example with Aggregates

```json
{
	"columns": ["category"],
	"aggregates": [
		{
			"column": "id",
			"function": "count",
			"alias": "product_count"
		},
		{
			"column": "price",
			"function": "avg",
			"alias": "average_price"
		}
	],
	"groupBy": ["category"]
}
```

Response:

```json
{
	"records": [
		{
			"category": "Electronics",
			"product_count": 42,
			"average_price": 299.99
		},
		{
			"category": "Books",
			"product_count": 156,
			"average_price": 15.99
		}
	],
	"count": 2
}
```

## Group By Parameter

The `groupBy` parameter groups results by one or more columns.

**Type:** `string[]`	
**Required:** Yes, when using aggregates	
**Default:** None

When grouping, you typically want to include the groupBy columns in your results along with aggregates:

```json
{
	"columns": ["status", "created_date"],
	"groupBy": ["status", "created_date"],
	"aggregates": [
		{
			"column": "id",
			"function": "count",
			"alias": "count"
		}
	]
}
```

**Note:** All aggregates require a groupBy clause. Without grouping, aggregation results would be ambiguous.

## Ordering Parameter

Control the sort order of results using `orderBy` and `orderDirection`.

**Types:**
- `orderBy` (keyof T, optional): Column to sort by
- `orderDirection` ('ASC' | 'DESC', optional): Sort direction, must be used with orderBy

### Example

```json
{
	"orderBy": "createdAt",
	"orderDirection": "DESC"
}
```

Sort by creation date in descending order (newest first).

```json
{
	"orderBy": "name",
	"orderDirection": "ASC"
}
```

Sort by name alphabetically.

**Note:** Both `orderBy` and `orderDirection` must be provided for sorting to work. If only one is provided, sorting is ignored.

## Pagination

Control which results are returned using `limit` and `offset`.

**Types:**
- `limit` (number, optional): Maximum number of records to return. Default: 1000
- `offset` (number, optional): Number of records to skip. Default: 0

### Example

```json
{
	"limit": 25,
	"offset": 0
}
```

Get the first 25 records.

```json
{
	"limit": 25,
	"offset": 25
}
```

Get records 26-50 (second page with 25 items per page).

**Best Practice:** Always use reasonable limits to avoid overloading the server. Typical values are 10-100 per page.

## Column Mapping

Column mapping is essential for security and flexibility. It prevents users from accessing arbitrary database columns and allows you to map user-facing names to actual database column names.

### Basic Mapping

```typescript
class UserSearchEndpoint extends RiaoSearchEndpoint<User> {
	protected override getColumnMap() {
		return {
			id: { column: 'users.id' },
			name: { column: 'users.name' },
			email: { column: 'users.email' },
			createdAt: { column: 'users.created_at' }, // Map API name to DB column
		};
	}
}
```

Users can only query columns listed in the column map.

### With Table Joins

For querying data across related tables:

```typescript
import { Join, identifier } from '@riao/dbal';

class OrderSearchEndpoint extends RiaoSearchEndpoint<Order> {
	protected override getColumnMap() {
		return {
			id: { column: 'orders.id' },
			status: { column: 'orders.status' },
			total: { column: 'orders.total' },
			// Access customer data through join
			customerName: {
				column: 'customers.name',
				join: {
					table: 'customers',
					joinType: 'INNER',
					on: {
						'orders.customer_id': identifier('customers.id')
					}
				}
			},
			customerEmail: {
				column: 'customers.email',
				join: {
					table: 'customers',
					joinType: 'INNER',
					on: {
						'orders.customer_id': identifier('customers.id')
					}
				}
			},
		};
	}
}
```

## Response Format

All search endpoint responses follow this format:

```json
{
	"records": [
		{
			"id": 1,
			"name": "John Doe",
			"email": "john@example.com"
		}
	],
	"count": 148
}
```

**Fields:**
- `records` (array): Array of matching records with requested columns
- `count` (number): Total count of matching records (before limit is applied)

## Complete Examples

### Example 1: Simple Search with Filtering

Find all active users with gmail addresses, sorted by name:

```json
{
	"where": [
		{
			"column": "status",
			"operator": "=",
			"value": "active"
		},
		{
			"column": "email",
			"operator": "LIKE",
			"value": "%@gmail.com"
		}
	],
	"orderBy": "name",
	"orderDirection": "ASC",
	"limit": 50
}
```

### Example 2: Pagination

Get the second page of results:

```json
{
	"limit": 20,
	"offset": 20
}
```

### Example 3: Column Selection

Return only specific fields:

```json
{
	"columns": ["id", "email"],
	"limit": 100
}
```

### Example 4: Aggregation with Grouping

Count users by status:

```json
{
	"columns": ["status"],
	"groupBy": ["status"],
	"aggregates": [
		{
			"column": "id",
			"function": "count",
			"alias": "count"
		}
	]
}
```

Response:

```json
{
	"records": [
		{ "status": "active", "count": 1250 },
		{ "status": "inactive", "count": 340 },
		{ "status": "pending", "count": 89 }
	],
	"count": 3
}
```

### Example 5: Complex Query

Advanced search with filters, aggregates, and sorting:

```json
{
	"columns": ["category", "status"],
	"where": [
		{
			"column": "price",
			"operator": ">=",
			"value": 50
		},
		{
			"column": "status",
			"operator": "INARRAY",
			"value": "available,limited"
		},
		{
			"column": "createdAt",
			"operator": "BETWEEN",
			"minValue": "2024-01-01",
			"maxValue": "2024-12-31"
		}
	],
	"groupBy": ["category", "status"],
	"aggregates": [
		{
			"column": "id",
			"function": "count",
			"alias": "count"
		},
		{
			"column": "price",
			"function": "avg",
			"alias": "avg_price"
		},
		{
			"column": "price",
			"function": "sum",
			"alias": "total_value"
		}
	],
	"orderBy": "category",
	"orderDirection": "ASC",
	"limit": 100
}
```

### Example 6: Custom Filtering with Conditions

Find products in price range with specific categories:

```json
{
	"columns": ["id", "name", "price", "category"],
	"where": [
		{
			"column": "price",
			"operator": "BETWEEN",
			"minValue": 10,
			"maxValue": 100
		},
		{
			"column": "category",
			"operator": "INARRAY",
			"value": "electronics,books,clothing"
		}
	],
	"orderBy": "price",
	"orderDirection": "ASC",
	"limit": 30
}
```

## Error Handling

The search endpoint validates input and returns appropriate errors:

- **Invalid column**: Returns 422 with message "Column \"X\" is not a valid selectable column."
- **Invalid operator**: Returns 422 with validation error
- **Missing groupBy with aggregates**: Returns 422 with message "At least one groupBy column is required when using aggregates."
- **Duplicate aggregates**: Returns 422 with message "Duplicate aggregate alias or column \"X\"."
- **Missing BETWEEN boundaries**: Returns 422 with message "BETWEEN operator requires both minValue and maxValue for column \"X\"."

## Best Practices

1. **Always define column maps** - This is critical for security and prevents users from accessing unintended columns
2. **Use fully-qualified column names in maps** - Map to `table.column` format to avoid ambiguity, especially when joins are involved:
	 ```typescript
	 override getColumnMap() {
		return {
				id: { column: 'users.id' },
				name: { column: 'users.name' },
		};
	 }
	 ```
3. **Use reasonable limits** - Default is 1000, but consider 10-100 for API responses
4. **Validate client input** - The endpoint validates, but handle errors gracefully in client code
5. **Index columns used in where clauses** - This improves query performance significantly
6. **Be careful with large aggregations** - COUNT(*) on very large tables can be slow
7. **Use pagination** - Always combine with limit/offset to handle large result sets
8. **Group before aggregating** - Remember that aggregates require groupBy clauses
