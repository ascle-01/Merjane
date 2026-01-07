import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {
	type IProductStrategy,
	type OrderProcessingResult,
	NormalProductStrategy,
	SeasonalProductStrategy,
	ExpirableProductStrategy,
} from '../strategies/index.js';
import {type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';


 // service responsible for processing product orders

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;
	private readonly strategies: Map<string, IProductStrategy>;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;

		// Initialize strategies for each product type
		this.strategies = new Map<string, IProductStrategy>([
			['NORMAL', new NormalProductStrategy()],
			['SEASONAL', new SeasonalProductStrategy()],
			['EXPIRABLE', new ExpirableProductStrategy()],
		]);
	}

	/**
	 * Process an order for a product
	 * Delegates to the appropriate strategy based on product type
	 *
	 * @param product - The product to process
	 * @returns Result of the order processing
	 * @throws Error if product type is not supported
	 */
	public async processProductOrder(product: Product): Promise<OrderProcessingResult> {
		const strategy = this.strategies.get(product.type);

		if (!strategy) {
			throw new Error(`Unsupported product type: ${product.type}`);
		}

		return strategy.processOrder(product, {
			db: this.db,
			ns: this.ns,
		});
	}

	/**
	 * Process multiple products in an order
	 *
	 * @param products - Array of products to process
	 * @returns Array of processing results
	 */
	public async processMultipleProducts(products: Product[]): Promise<OrderProcessingResult[]> {
		const results = await Promise.all(
			products.map(async product => this.processProductOrder(product)),
		);

		return results;
	}
}
