import path from 'node:path';
import process from 'node:process';
import convict from 'convict';
import convict_format_with_validator from 'convict-format-with-validator';
import dotenv from 'dotenv';

convict.addFormats(convict_format_with_validator);

const dotenvPath = process.env['CONFIG_PATH']
	? path.resolve(process.cwd(), process.env['CONFIG_PATH'])
	: undefined;

if (dotenvPath) {
	console.log(`Loading env variables from "${dotenvPath}"`);
}

dotenv.config(dotenvPath ? {path: dotenvPath} : undefined);

export {default as dotEnvConvict} from 'convict';
