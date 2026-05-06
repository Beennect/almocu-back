import { Model } from 'mongoose';
import { Order } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
export declare class OrderService {
    private orderModel;
    constructor(orderModel: Model<Order>);
    private calcularTotal;
    create(userId: string, restaurantId: string, createOrderDto: CreateOrderDto): Promise<Order>;
    findOne(id: string, userId: string, restaurantId: string): Promise<Order>;
    findAllByRestaurant(restaurantId: string): Promise<Order[]>;
    findAllByUser(userId: string): Promise<Order[]>;
    updateStatus(id: string, userId: string, restaurantId: string, status: string): Promise<Order>;
    remove(id: string, restaurantId: string): Promise<void>;
}
