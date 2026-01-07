import {UNIT_TEST_DB_PREFIX, cleanAllLooseDatabases} from './database-tools.ts.js';

export async function setup() {
	await cleanAllLooseDatabases(UNIT_TEST_DB_PREFIX);
}

export async function teardown() {
	await cleanAllLooseDatabases(UNIT_TEST_DB_PREFIX);
}
