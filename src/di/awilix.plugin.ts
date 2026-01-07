import {fastifyAwilixPlugin} from '@fastify/awilix';
import {type FastifyPluginAsync} from 'fastify';
import fastifyPlugin from 'fastify-plugin';

export function awilixPlugin(): FastifyPluginAsync {
	return fastifyPlugin(async server => {
		await server.register(fastifyAwilixPlugin, {
			disposeOnClose: true,
			disposeOnResponse: true,
		});
	});
}
