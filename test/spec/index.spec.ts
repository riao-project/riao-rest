import 'jasmine';
import { maindb } from '../../database/main';
import { Server } from '../../examples/quick-start';
import { env } from '../env';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationRunner } from '@riao/dbal';

const server = new Server({
	port: env.API_PORT,
});

beforeAll(async () => {
	const dbPath = 'database/main';
	const dbFile = `${dbPath}/databases/${Date.now()}_test.db`;
	const dir = path.dirname(dbFile);
	fs.mkdirSync(dir, { recursive: true });

	await maindb.init({
		connectionOptions: {
			...maindb.env,
			database: dbFile,
		},
		useSchemaCache: false,
	});

	const migrationRunner = new MigrationRunner(maindb);
	await migrationRunner.run(
		path.join(dbPath, maindb.migrations),
		// eslint-disable-next-line no-console
		console.log
	);

	await server.start();
});

afterAll(async () => {
	await server.stop();
	await maindb.disconnect();
});
