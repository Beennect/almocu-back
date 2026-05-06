import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
export declare class OrderController {
    private readonly orderService;
    constructor(orderService: OrderService);
    create(userId: string, restaurantId: string, createOrderDto: CreateOrderDto): Promise<import("./order.schema").Order>;
    findAll(restaurantId: string): Promise<import("./order.schema").Order[]>;
    findAllByUser(userId: string): Promise<import("./order.schema").Order[]>;
    findOne(id: string, userId: string, restaurantId: string): Promise<import("./order.schema").Order>;
    updateStatus(id: string, userId: string, restaurantId: string, updateStatusDto: UpdateOrderStatusDto): Promise<import("./order.schema").Order>;
    remove(id: string, restaurantId: string): Promise<void>;
}
