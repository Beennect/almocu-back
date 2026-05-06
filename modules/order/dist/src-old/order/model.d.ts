import { HydratedDocument } from 'mongoose';
export interface IOrderItem {
    productName: string;
    quantity: number;
    price: number;
    observations?: string;
}
export interface IOrder {
    restaurantId: string;
    userId: string;
    items: IOrderItem[];
    totalValue: number;
    status: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
    origin?: string;
    observations?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export type OrderDocument = HydratedDocument<IOrder>;
export declare const OrderModel: import("mongoose").Model<IOrder, {}, {}, {}, import("mongoose").Document<unknown, {}, IOrder, {}, {}> & IOrder & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
