import {type INotificationService} from '../notifications.port.js';
import {type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

/**
 * Context object containing dependencies needed by product strategies
 */
export type StrategyContext = {
	db: Database;
	ns: INotificationService;
};

/**
 * Result of processing a product order
 */
export type OrderProcessingResult = {
	success: boolean;
	productUpdated: boolean;
	availableDecremented: boolean;
};

/**
 * Strategy interface for handling different product types
 */
export type IProductStrategy = {
	/**
	 * Process an order for a specific product
	 * @param product - The product being ordered
	 * @param context - Dependencies needed for processing
	 * @returns Result indicating what happened during processing
	 */
	processOrder(product: Product, context: StrategyContext): Promise<OrderProcessingResult>;
};
