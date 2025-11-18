import { maindb } from '../database/main';
import { Server } from '../examples/quick-start';

/**
 * Do something!
 */
export default async function example(): Promise<void> {
	await maindb.init();

	await new Server({
		port: 4000,
		swaggerEnabled: true,
	}).start();

	// eslint-disable-next-line no-console
	console.log('Server started on http://localhost:4000');

	await new Promise(() => {});
}
