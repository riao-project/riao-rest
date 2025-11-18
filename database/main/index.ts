import { DatabaseSqlite } from '@riao/sqlite';

export default class MainDatabase extends DatabaseSqlite {
	override name = 'main';
}

export const maindb = new MainDatabase();
