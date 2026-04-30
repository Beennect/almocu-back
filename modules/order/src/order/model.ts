import { Schema, model, HydratedDocument } from 'mongoose';

// Interface de um item dentro do pedido
export interface IOrderItem 
{
    productName: string;
    quantity: number;
    price: number;
    observations?: string;
}

// Interface principal do pedido
export interface IOrder 
{
    restaurantId: string;
    items: IOrderItem[];
    totalValue: number;
    status: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
    origin?: string;
    observations?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

const OrderItemSchema = new Schema<IOrderItem>
(
    {
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        observations: { type: String, maxlength: 500 },
    },
    { _id: false } // items não precisam de _id próprio
);

const OrderSchema = new Schema<IOrder>
(
    {
        restaurantId: { type: String, required: true, index: true },
        items: 
        { 
            type: [OrderItemSchema], 
            required: true, 
            validate: { 
                validator: (items: IOrderItem[]) => items.length > 0, 
                message: 'O pedido deve ter ao menos um item!' 
            } 
        },
        totalValue: { type: Number, required: true, min: 0 },
        status: 
        {
            type: String,
            required: true,
            default: 'pendente',
            enum: ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'],
        },
        origin: { type: String, maxlength: 50 },
        observations: { type: String, maxlength: 500 },
    },
    { timestamps: true }
);

export const OrderModel = model<IOrder>('Order', OrderSchema);
