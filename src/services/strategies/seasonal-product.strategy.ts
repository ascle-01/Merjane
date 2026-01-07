import {eq} from 'drizzle-orm';
import {
	type IProductStrategy,
	type OrderProcessingResult,
	type StrategyContext,
} from './product-strategy.interface.js';
import {products, type Product} from '@/db/schema.js';

/**
 * Strategy for handling SEASONAL products
 *
 * Business rules:
 * - Only available during season (between seasonStartDate and seasonEndDate)
 * - If available in season, decrement stock
 * - If out of stock but in season, check if restock would arrive in time
 * - If before season starts, notify out of stock
 * - If restock would arrive after season ends, notify out of stock
 */
export class SeasonalProductStrategy implements IProductStrategy {
	async processOrder(product: Product, context: StrategyContext): Promise<OrderProcessingResult> {
		const {db, ns} = context;
		const currentDate = new Date();

		// Check if we're in the season and product is available
		if (
			product.available > 0
			&& product.seasonStartDate
			&& product.seasonEndDate
			&& currentDate >= product.seasonStartDate
			&& currentDate <= product.seasonEndDate
		) {
			product.available -= 1;
			await db.update(products).set(product).where(eq(products.id, product.id));
			return {
				success: true,
				productUpdated: true,
				availableDecremented: true,
			};
		}

		// Product is out of stock or out of season - check various scenarios
		return this.handleOutOfStockOrOutOfSeason(product, currentDate, context);
	}

	private async handleOutOfStockOrOutOfSeason(
		product: Product,
		currentDate: Date,
		context: StrategyContext,
	): Promise<OrderProcessingResult> {
		const {db, ns} = context;

		// Season hasn't started yet
		if (product.seasonStartDate && currentDate < product.seasonStartDate) {
			ns.sendOutOfStockNotification(product.name);
			return {
				success: false,
				productUpdated: false,
				availableDecremented: false,
			};
		}

		// Calculate when restock would arrive
		const millisecondsPerDay = 1000 * 60 * 60 * 24;
		const restockDate = new Date(currentDate.getTime() + (product.leadTime * millisecondsPerDay));

		// Restock would arrive after season ends
		if (product.seasonEndDate && restockDate > product.seasonEndDate) {
			ns.sendOutOfStockNotification(product.name);
			product.available = 0;
			await db.update(products).set(product).where(eq(products.id, product.id));
			return {
				success: false,
				productUpdated: true,
				availableDecremented: false,
			};
		}

		// Restock will arrive in time - notify delay
		ns.sendDelayNotification(product.leadTime, product.name);
		await db.update(products).set(product).where(eq(products.id, product.id));
		return {
			success: true,
			productUpdated: true,
			availableDecremented: false,
		};
	}
}
