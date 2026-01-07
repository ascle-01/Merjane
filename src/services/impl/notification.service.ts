/* eslint-disable @typescript-eslint/no-empty-function */
// WARN: Should not be changed during the exercise
import {type INotificationService} from '../notifications.port.js';

export class NotificationService implements INotificationService {
	public sendDelayNotification(_leadTime: number, _productName: string) {}

	public sendOutOfStockNotification(_productName: string) {}

	public sendExpirationNotification(_productName: string, _expiryDate: Date) {}
}
