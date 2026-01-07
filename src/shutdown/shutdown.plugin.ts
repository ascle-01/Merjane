import process from 'node:process';
import {type FastifyPluginAsync} from 'fastify';

const shutdownPlugin: FastifyPluginAsync = async server => {
	process.on('SIGINT', async () => server.close());
	process.on('SIGTERM', async () => server.close());
};

export default shutdownPlugin;
