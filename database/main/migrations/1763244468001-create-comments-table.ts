import { Migration, ColumnType } from '@riao/dbal';
import { BigIntKeyColumn } from '@riao/dbal/column-pack';

export default class CreateCommentsTable extends Migration {
	override async up() {
		await this.ddl.createTable({
			name: 'comments',
			columns: [
				BigIntKeyColumn,
				{
					name: 'post_id',
					type: ColumnType.BIGINT,
				},
				{
					name: 'user_id',
					type: ColumnType.BIGINT,
				},
				{
					name: 'content',
					type: ColumnType.TEXT,
				},
				{
					name: 'rating',
					type: ColumnType.INT,
				},
				{
					name: 'created_at',
					type: ColumnType.TIMESTAMP,
					default: 'CURRENT_TIMESTAMP',
				},
			],
		});
	}
}
