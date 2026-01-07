/* eslint-disable @typescript-eslint/switch-exhaustiveness-check */
/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import {eq} from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {orders, products} from '@/db/schema.js';

export const myController = fastifyPlugin(async server => {
	// Add schema validator and serializer
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number(),
			}),
		},
	}, async (request, reply) => {
		const dbse = server.diContainer.resolve('db');
		const ps = server.diContainer.resolve('ps');
		const order = (await dbse.query.orders
			.findFirst({
				where: eq(orders.id, request.params.orderId),
				with: {
					products: {
						columns: {},
						with: {
							product: true,
						},
					},
				},
			}))!;
		console.log(order);
		const ids: number[] = [request.params.orderId];
		const {products: productList} = order;

		if (productList) {
			for (const {product: p} of productList) {
				switch (p.type) {
					case 'NORMAL': {
						if (p.available > 0) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							const {leadTime} = p;
							if (leadTime > 0) {
								await ps.notifyDelay(leadTime, p);
							}
						}

						break;
					}

					case 'SEASONAL': {
						const currentDate = new Date();
						if (currentDate > p.seasonStartDate! && currentDate < p.seasonEndDate! && p.available > 0) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							await ps.handleSeasonalProduct(p);
						}

						break;
					}

					case 'EXPIRABLE': {
						const currentDate = new Date();
						if (p.available > 0 && p.expiryDate! > currentDate) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							await ps.handleExpiredProduct(p);
						}

						break;
					}
				}
			}
		}

		await reply.send({orderId: order.id});
	});
});

