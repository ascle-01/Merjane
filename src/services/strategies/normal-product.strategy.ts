import {eq} from 'drizzle-orm';
import {
	type IProductStrategy,
	type OrderProcessingResult,
	type StrategyContext,
} from './product-strategy.interface.js';
import {products, type Product} from '@/db/schema.js';

/**
 * Strategy for handling NORMAL products
 *
 * Business rules:
 * - If product is available, decrement stock
 * - If out of stock, notify customer of lead time delay
 */
export class NormalProductStrategy implements IProductStrategy {
	async processOrder(product: Product, context: StrategyContext): Promise<OrderProcessingResult> {
		const {db, ns} = context;

		// Product is available in stock
		if (product.available > 0) {
			product.available -= 1;
			await db.update(products).set(product).where(eq(products.id, product.id));
			return {
				success: true,
				productUpdated: true,
				availableDecremented: true,
			};
		}

		// Product is out of stock - notify delay
		if (product.leadTime > 0) {
			ns.sendDelayNotification(product.leadTime, product.name);
			// Lead time stays the same
			await db.update(products).set(product).where(eq(products.id, product.id));
			return {
				success: true,
				productUpdated: true,
				availableDecremented: false,
			};
		}

		// No stock and no lead time available
		return {
			success: false,
			productUpdated: false,
			availableDecremented: false,
		};
	}
}
