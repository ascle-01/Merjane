import {dotEnvConvict} from './convict.js';

export const ENVS = ['LOCAL', 'DEV', 'PREPROD', 'PROD', 'TEST'] as const;
export type EnvType = (typeof ENVS)[number];

export const CONFIG = dotEnvConvict({
	app: {
		env: {
			doc: 'application environment',
			format: ENVS,
			default: 'PROD' as EnvType,
			env: 'APP_ENV',
		},
	},
	server: {
		port: {
			doc: 'server port',
			format: 'port',
			default: 8080,
			env: 'PORT',
		},
		timeout: {
			doc: 'Request timeout (in ms)',
			format: 'int',
			default: 3000,
			env: 'SERVER_TIMEOUT',
		},
	},
	db: {
		url: {
			doc: 'Database connection uri',
			format: String,
			default: './database.db',
			env: 'DB_URI',
		},
	},
	log: {
		level: {
			doc: 'Log level',
			format: ['error', 'warning', 'notice', 'info', 'debug'],
			default: 'warning',
			env: 'LOG_LEVEL',
		},
		format: {
			doc: 'Log format',
			format: '*',
			default: 'tiny',
			env: 'LOG_FORMAT',
		},
	},
	debug: {
		sourcemap: {
			doc: 'Enable source-map',
			format: 'Boolean',
			default: false,
			env: 'SOURCE_MAP',
		},
	},
});

CONFIG.validate({allowed: 'strict'});

export type Config = typeof CONFIG;
