import { Types } from 'mongoose';
import { OrderModel, IOrder, IOrderItem } from './model';

type CreateOrderInput = 
{
    restaurantId: string;
    items: IOrderItem[];
    origin?: string;
    observations?: string;
};

type UpdateOrderInput = 
{
    status?: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
    observations?: string;
};

export class OrderService 
{
    private calcularTotal(items: IOrderItem[]): number 
    {
        if (items.some(item => item.quantity <= 0 || item.price < 0)) throw new Error('Itens inválidos no pedido');

        return items.reduce((total, item) => total + item.quantity * item.price, 0);     // Calcula o valor total somando quantidade * preço de cada item
    }

    public async create(data: CreateOrderInput): Promise<IOrder> 
    {
        if (!data.restaurantId) throw new Error('Por favor, informe o restaurante!');
        if (!data.items || data.items.length === 0) throw new Error('O pedido deve ter ao menos um item!');

        const totalValue = this.calcularTotal(data.items);

        const order = new OrderModel({
            restaurantId: data.restaurantId,
            items: data.items,
            totalValue,
            origin: data.origin,
            observations: data.observations,
        });

        return order.save();
    }

    public async getById(id: string): Promise<IOrder | null> 
    {
        if (!Types.ObjectId.isValid(id)) return null;
        
        return OrderModel.findById(id);
    }

    public async getAll(): Promise<IOrder[]> 
    {
        return OrderModel.find().limit(100).sort({ createdAt: -1 });
    }

    public async getAllByRestaurantId(restaurantId: string): Promise<IOrder[]> 
    {
        return OrderModel.find({ restaurantId }).limit(100).sort({ createdAt: -1 });
    }

    public async update(id: string, data: UpdateOrderInput): Promise<IOrder | null> 
    {
        const updateData: Partial<UpdateOrderInput> = {};

        if (!Types.ObjectId.isValid(id)) return null;
        if (!data || Object.keys(data).length === 0) throw new Error('Nenhum dado para atualizar');

        if (data.status) 
        {
            const allowedStatus = ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
            if (!allowedStatus.includes(data.status)) throw new Error('Status inválido!');

            updateData.status = data.status;
        }

        if (data.observations !== undefined)
        {
            updateData.observations = data.observations;
        }

        return OrderModel.findByIdAndUpdate(id, updateData, { new: true });
    }

    public async deleteById(id: string): Promise<IOrder | null> 
    {
        if (!Types.ObjectId.isValid(id)) return null;

        const deleted = await OrderModel.findByIdAndDelete(id);

        return deleted;
    }
}