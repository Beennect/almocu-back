import { Document, Types } from 'mongoose';
declare class OrderItem {
    productId: Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
}
export declare class Order extends Document {
    restaurantId: Types.ObjectId;
    userId: Types.ObjectId;
    items: OrderItem[];
    totalValue: number;
    status: string;
    origin: string;
    observations: string;
}
export declare const OrderSchema: any;
export {};
