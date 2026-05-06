declare class OrderItemDto {
    productId: string;
    name: string;
    quantity: number;
    price: number;
}
export declare class CreateOrderDto {
    items: OrderItemDto[];
    origin?: string;
    observations?: string;
}
export declare class UpdateOrderStatusDto {
    status: string;
}
export {};
