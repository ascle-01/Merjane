/* eslint-disable unicorn/prefer-module */
import path from 'node:path';
import process from 'node:process';
import {defineConfig} from 'drizzle-kit';
import dotenv from 'dotenv';

const dotenvPath = process.env['CONFIG_PATH']
	? path.resolve(process.cwd(), process.env['CONFIG_PATH'])
	: undefined;
dotenv.config(dotenvPath ? {path: dotenvPath} : undefined);

export default defineConfig({
	schema: './src/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env['DB_URI']!,
	},
});
