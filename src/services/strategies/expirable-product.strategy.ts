import {eq} from 'drizzle-orm';
import {
	type IProductStrategy,
	type OrderProcessingResult,
	type StrategyContext,
} from './product-strategy.interface.js';
import {products, type Product} from '@/db/schema.js';

/**
 * handling EXPIRABLE products
 *
 * Business rules:
 * - Can be sold normally while not expired and in stock
 * - Once expired, product is no longer available
 * - If expired or no stock, notify customers of expiration
 */
export class ExpirableProductStrategy implements IProductStrategy {
	async processOrder(product: Product, context: StrategyContext): Promise<OrderProcessingResult> {
		const {db, ns} = context;
		const currentDate = new Date();

		// Product is available and not expired
		if (
			product.available > 0
			&& product.expiryDate
			&& product.expiryDate > currentDate
		) {
			product.available -= 1;
			await db.update(products).set(product).where(eq(products.id, product.id));
			return {
				success: true,
				productUpdated: true,
				availableDecremented: true,
			};
		}

		// Product is expired or out of stock
		return this.handleExpiredOrOutOfStock(product, context);
	}

	private async handleExpiredOrOutOfStock(
		product: Product,
		context: StrategyContext,
	): Promise<OrderProcessingResult> {
		const {db, ns} = context;

		if (!product.expiryDate) {
			// Should not happen for expirable products, but handle gracefully
			return {
				success: false,
				productUpdated: false,
				availableDecremented: false,
			};
		}

		// Notify about expiration and mark as unavailable
		ns.sendExpirationNotification(product.name, product.expiryDate);
		product.available = 0;
		await db.update(products).set(product).where(eq(products.id, product.id));

		return {
			success: false,
			productUpdated: true,
			availableDecremented: false,
		};
	}
}
