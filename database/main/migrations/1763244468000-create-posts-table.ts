import { Migration, ColumnType } from '@riao/dbal';
import { BigIntKeyColumn } from '@riao/dbal/column-pack';

export default class CreatePostsTable extends Migration {
	override async up() {
		await this.ddl.createTable({
			name: 'posts',
			columns: [
				BigIntKeyColumn,
				{
					name: 'user_id',
					type: ColumnType.BIGINT,
				},
				{
					name: 'title',
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
