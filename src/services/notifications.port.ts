
// WARN: Should not be changed during the exercise
export type INotificationService = {
	sendDelayNotification(leadTime: number, productName: string): void;

	sendOutOfStockNotification(productName: string): void;

	sendExpirationNotification(productName: string, expiryDate: Date): void;
};
