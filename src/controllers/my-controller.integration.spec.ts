import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {eq} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			ns: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});
	afterEach(async () => {
		await fastify.close();
	});

	it('should process order and return order ID', async () => {
		const client = supertest(fastify.server);
		const allProducts = createProducts();
		const orderId = await database.transaction(async tx => {
			const productList = await tx.insert(products).values(allProducts).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values(productList.map(p => ({orderId: order!.orderId, productId: p.productId})));
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200).expect('Content-Type', /application\/json/);

		const resultOrder = await database.query.orders.findFirst({where: eq(orders.id, orderId)});
		expect(resultOrder!.id).toBe(orderId);
	});

	it('should return 404 for non-existent order', async () => {
		const client = supertest(fastify.server);
		const nonExistentOrderId = 99_999;

		const response = await client
			.post(`/orders/${nonExistentOrderId}/processOrder`)
			.expect(404)
			.expect('Content-Type', /application\/json/);

		expect(response.body).toEqual({error: 'Order not found'});
	});

	it('should decrement stock for available NORMAL product', async () => {
		const client = supertest(fastify.server);
		const product: ProductInsert = {
			leadTime: 15,
			available: 30,
			type: 'NORMAL',
			name: 'USB Cable',
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		const updatedProduct = await database.query.products.findFirst();
		expect(updatedProduct!.available).toBe(29);
		expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
	});

	it('should notify delay for out-of-stock NORMAL product', async () => {
		const client = supertest(fastify.server);
		const product: ProductInsert = {
			leadTime: 10,
			available: 0,
			type: 'NORMAL',
			name: 'USB Dongle',
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
	});

	it('should decrement stock for available EXPIRABLE product not expired', async () => {
		const client = supertest(fastify.server);
		const d = 24 * 60 * 60 * 1000;
		const product: ProductInsert = {
			leadTime: 15,
			available: 30,
			type: 'EXPIRABLE',
			name: 'Butter',
			expiryDate: new Date(Date.now() + (26 * d)),
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		const updatedProduct = await database.query.products.findFirst();
		expect(updatedProduct!.available).toBe(29);
		expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
	});

	it('should notify expiration for expired EXPIRABLE product', async () => {
		const client = supertest(fastify.server);
		const d = 24 * 60 * 60 * 1000;
		const expiryDate = new Date(Date.now() - (2 * d));
		const product: ProductInsert = {
			leadTime: 90,
			available: 6,
			type: 'EXPIRABLE',
			name: 'Milk',
			expiryDate,
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		const updatedProduct = await database.query.products.findFirst();
		expect(updatedProduct!.available).toBe(0);
		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
	});

	it('should decrement stock for available SEASONAL product in season', async () => {
		const client = supertest(fastify.server);
		const d = 24 * 60 * 60 * 1000;
		const product: ProductInsert = {
			leadTime: 15,
			available: 30,
			type: 'SEASONAL',
			name: 'Watermelon',
			seasonStartDate: new Date(Date.now() - (2 * d)),
			seasonEndDate: new Date(Date.now() + (58 * d)),
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		const updatedProduct = await database.query.products.findFirst();
		expect(updatedProduct!.available).toBe(29);
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
	});

	it('should notify out of stock for SEASONAL product before season', async () => {
		const client = supertest(fastify.server);
		const d = 24 * 60 * 60 * 1000;
		const product: ProductInsert = {
			leadTime: 15,
			available: 30,
			type: 'SEASONAL',
			name: 'Grapes',
			seasonStartDate: new Date(Date.now() + (180 * d)),
			seasonEndDate: new Date(Date.now() + (240 * d)),
		};

		const orderId = await database.transaction(async tx => {
			const [insertedProduct] = await tx.insert(products).values(product).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values([{orderId: order!.orderId, productId: insertedProduct!.productId}]);
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
	});

	it('should process multiple products in one order correctly', async () => {
		const client = supertest(fastify.server);
		const allProducts = createProducts();
		const orderId = await database.transaction(async tx => {
			const productList = await tx.insert(products).values(allProducts).returning({productId: products.id});
			const [order] = await tx.insert(orders).values([{}]).returning({orderId: orders.id});
			await tx.insert(ordersToProducts).values(productList.map(p => ({orderId: order!.orderId, productId: p.productId})));
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200);

		// Verify notifications were sent appropriately
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalled();
		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalled();
		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalled();

		// Verify stock was decremented for available products
		const allProductsAfter = await database.query.products.findMany();
		const usbCable = allProductsAfter.find(p => p.name === 'USB Cable');
		expect(usbCable!.available).toBe(29); // Should be decremented from 30 to 29

		const butter = allProductsAfter.find(p => p.name === 'Butter');
		expect(butter!.available).toBe(29); // Should be decremented from 30 to 29

		const watermelon = allProductsAfter.find(p => p.name === 'Watermelon');
		expect(watermelon!.available).toBe(29); // Should be decremented from 30 to 29
	});

	function createProducts(): ProductInsert[] {
		const d = 24 * 60 * 60 * 1000;
		return [
			{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			},
			{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			},
			{
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter', expiryDate: new Date(Date.now() + (26 * d)),
			},
			{
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate: new Date(Date.now() - (2 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon', seasonStartDate: new Date(Date.now() - (2 * d)), seasonEndDate: new Date(Date.now() + (58 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes', seasonStartDate: new Date(Date.now() + (180 * d)), seasonEndDate: new Date(Date.now() + (240 * d)),
			},
		];
	}
});
