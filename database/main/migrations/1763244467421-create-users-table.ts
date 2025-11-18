import { Migration } from '@riao/dbal';
import {
	BigIntKeyColumn,
	EmailColumn,
	NameColumn,
} from '@riao/dbal/column-pack';

export default class CreateUsersTable extends Migration {
	override async up() {
		await this.ddl.createTable({
			name: 'users',
			columns: [BigIntKeyColumn, NameColumn, EmailColumn],
		});
	}
}
