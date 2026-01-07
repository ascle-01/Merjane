import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let sqlite: any;

	beforeEach(async () => {
		({databaseMock, databaseName, sqlite} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => {
		// Close the database connection before cleanup
		if (sqlite) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			sqlite.close();
		}

		await cleanUp(databaseName);
	});

	describe('NORMAL Products', () => {
		it('should decrement available stock when product is available', async () => {
			// GIVEN
			const product: Product = {
				id: 1,
				leadTime: 15,
				available: 5,
				type: 'NORMAL',
				name: 'USB Cable',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(true);
			expect(result.availableDecremented).toBe(true);
			expect(result.productUpdated).toBe(true);

			const updatedProduct = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(updatedProduct?.available).toBe(4);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('should notify delay when product is out of stock', async () => {
			// GIVEN
			const product: Product = {
				id: 2,
				leadTime: 10,
				available: 0,
				type: 'NORMAL',
				name: 'USB Dongle',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(true);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		});

		it('should handle product with 0 lead time and 0 stock', async () => {
			// GIVEN
			const product: Product = {
				id: 3,
				leadTime: 0,
				available: 0,
				type: 'NORMAL',
				name: 'Discontinued Item',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(false);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});
	});

	describe('SEASONAL Products', () => {
		const millisecondsPerDay = 24 * 60 * 60 * 1000;

		it('should decrement stock when product is available and in season', async () => {
			// GIVEN
			const now = new Date();
			const product: Product = {
				id: 4,
				leadTime: 15,
				available: 10,
				type: 'SEASONAL',
				name: 'Watermelon',
				expiryDate: null,
				seasonStartDate: new Date(now.getTime() - (2 * millisecondsPerDay)),
				seasonEndDate: new Date(now.getTime() + (58 * millisecondsPerDay)),
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(true);
			expect(result.availableDecremented).toBe(true);

			const updatedProduct = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(updatedProduct?.available).toBe(9);
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('should notify out of stock when season has not started', async () => {
			// GIVEN
			const now = new Date();
			const product: Product = {
				id: 5,
				leadTime: 15,
				available: 10,
				type: 'SEASONAL',
				name: 'Grapes',
				expiryDate: null,
				seasonStartDate: new Date(now.getTime() + (180 * millisecondsPerDay)),
				seasonEndDate: new Date(now.getTime() + (240 * millisecondsPerDay)),
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(false);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		});

		it('should notify delay when out of stock but restock arrives in time', async () => {
			// GIVEN
			const now = new Date();
			const product: Product = {
				id: 6,
				leadTime: 10,
				available: 0,
				type: 'SEASONAL',
				name: 'Strawberries',
				expiryDate: null,
				seasonStartDate: new Date(now.getTime() - (5 * millisecondsPerDay)),
				seasonEndDate: new Date(now.getTime() + (30 * millisecondsPerDay)),
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(true);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'Strawberries');
		});

		it('should notify out of stock when restock would arrive after season ends', async () => {
			// GIVEN
			const now = new Date();
			const product: Product = {
				id: 7,
				leadTime: 100,
				available: 0,
				type: 'SEASONAL',
				name: 'Cherries',
				expiryDate: null,
				seasonStartDate: new Date(now.getTime() - (5 * millisecondsPerDay)),
				seasonEndDate: new Date(now.getTime() + (20 * millisecondsPerDay)),
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(false);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Cherries');

			const updatedProduct = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(updatedProduct?.available).toBe(0);
		});
	});

	describe('EXPIRABLE Products', () => {
		const millisecondsPerDay = 24 * 60 * 60 * 1000;

		it('should decrement stock when product is available and not expired', async () => {
			// GIVEN
			const now = new Date();
			const product: Product = {
				id: 8,
				leadTime: 15,
				available: 30,
				type: 'EXPIRABLE',
				name: 'Butter',
				expiryDate: new Date(now.getTime() + (26 * millisecondsPerDay)),
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(true);
			expect(result.availableDecremented).toBe(true);

			const updatedProduct = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(updatedProduct?.available).toBe(29);
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		});

		it('should notify expiration when product is expired', async () => {
			// GIVEN
			const now = new Date();
			const expiryDate = new Date(now.getTime() - (2 * millisecondsPerDay));
			const product: Product = {
				id: 9,
				leadTime: 90,
				available: 6,
				type: 'EXPIRABLE',
				name: 'Milk',
				expiryDate,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(false);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);

			const updatedProduct = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(updatedProduct?.available).toBe(0);
		});

		it('should notify expiration when product is out of stock but not expired', async () => {
			// GIVEN
			const now = new Date();
			const expiryDate = new Date(now.getTime() + (10 * millisecondsPerDay));
			const product: Product = {
				id: 10,
				leadTime: 5,
				available: 0,
				type: 'EXPIRABLE',
				name: 'Yogurt',
				expiryDate,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			const result = await productService.processProductOrder(product);

			// THEN
			expect(result.success).toBe(false);
			expect(result.availableDecremented).toBe(false);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Yogurt', expiryDate);
		});
	});

	describe('processMultipleProducts', () => {
		it('should process multiple products successfully', async () => {
			// GIVEN
			const product1: Product = {
				id: 11,
				leadTime: 5,
				available: 10,
				type: 'NORMAL',
				name: 'Product 1',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			const product2: Product = {
				id: 12,
				leadTime: 10,
				available: 0,
				type: 'NORMAL',
				name: 'Product 2',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values([product1, product2]);

			// WHEN
			const results = await productService.processMultipleProducts([product1, product2]);

			// THEN
			expect(results).toHaveLength(2);
			expect(results[0].success).toBe(true);
			expect(results[0].availableDecremented).toBe(true);
			expect(results[1].success).toBe(true);
			expect(results[1].availableDecremented).toBe(false);
		});
	});

	describe('Error Handling', () => {
		it('should throw error for unsupported product type', async () => {
			// GIVEN
			const product: Product = {
				id: 13,
				leadTime: 5,
				available: 10,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				type: 'UNKNOWN' as any,
				name: 'Invalid Product',
				expiryDate: null,
				seasonStartDate: null,
				seasonEndDate: null,
			};

			// WHEN & THEN
			await expect(productService.processProductOrder(product))
				.rejects
				.toThrow('Unsupported product type: UNKNOWN');
		});
	});
});
