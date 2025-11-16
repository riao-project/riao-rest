import { AppConfig } from 'ts-appconfig';

export class TestEnvironment extends AppConfig {
	readonly API_URL = 'http://localhost:4001';
	readonly API_PORT = 4001;
}

export const env = new TestEnvironment();
