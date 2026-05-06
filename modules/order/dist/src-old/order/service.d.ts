import { IOrder, IOrderItem } from './model';
type CreateOrderInput = {
    restaurantId: string;
    userId: string;
    items: IOrderItem[];
    origin?: string;
    observations?: string;
};
type UpdateOrderInput = {
    status?: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
    observations?: string;
};
export declare class OrderService {
    private calcularTotal;
    create(data: CreateOrderInput): Promise<IOrder>;
    getById(id: string, userId: string, restaurantId: string): Promise<IOrder | null>;
    getAllFromUser(userId: string): Promise<IOrder[]>;
    getAllByRestaurantId(userId: string, restaurantId: string): Promise<IOrder[]>;
    update(id: string, userId: string, restaurantId: string, data: UpdateOrderInput): Promise<IOrder | null>;
    deleteById(id: string, userId: string, restaurantId: string): Promise<IOrder | null>;
}
export {};
