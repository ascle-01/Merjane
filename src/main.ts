import {install as sourceMapSupport} from 'source-map-support';
import {CONFIG} from './configuration/index.js';
import {buildFastify} from './fastify.js';

const main = async () => {
	const serverConfig = CONFIG.get('server');
	const debugConfig = CONFIG.get('debug');

	if (debugConfig.sourcemap) {
		sourceMapSupport();
	}

	const server = await buildFastify();

	server.listen({host: '0.0.0.0', port: serverConfig.port}, error => {
		if (error) {
			throw error;
		}
	});

	server.ready(() => {
		const routes = server.printRoutes();
		console.log(`Available Routes:\n${routes}`);
	});
};

main(); // eslint-disable-line @typescript-eslint/no-floating-promises

