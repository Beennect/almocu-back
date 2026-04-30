import { Request, Response } from 'express';
import { OrderService } from './service';
import { Types } from 'mongoose';

const service = new OrderService();

export async function createOrder(req: Request, res: Response) {
    const { restaurantId, items, origin, observations } = req.body;

    try 
    {
        if (!restaurantId || !items || !Array.isArray(items) || items.length === 0) 
        {
            return res.status(400).json({ message: 'Por favor, preencha os dados obrigatórios!' });
        }

        const order = await service.create({ restaurantId, items, origin, observations });

        return res.status(201).json(order);
    } 
    catch (error: any) 
    {
        console.log(error);

        return res.status(500).json({ message: error.message || 'Erro interno ao criar o pedido.' });
    }
}

export async function getOrderById(req: Request<{ id: string }>, res: Response) {
    const { id } = req.params;

    try 
    {
        const order = await service.getById(id);
        if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

        return res.json(order);
    } 
    catch (error) 
    {
        return res.status(500).json({ message: 'Erro interno na busca do pedido.' });
    }
}

export async function getAllOrders(req: Request, res: Response) {
    const restaurantId = req.query.restaurantId as string | undefined;

    try 
    {
        // Se vier restaurantId na query, filtra por restaurante; senão retorna todos
        const orders = restaurantId ? await service.getAllByRestaurantId(restaurantId) : await service.getAll();

        if (orders.length === 0) return res.json(orders);

        return res.json(orders);
    } 
    catch (error) 
    {
        return res.status(500).json({ message: 'Erro interno na busca dos pedidos.' });
    }
}

export async function updateOrder(req: Request<{id: string }>, res: Response) {
    const { id } = req.params;
    const { status, observations } = req.body;
    const allowedStatus = ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'];

    try 
    {
        if (status && !allowedStatus.includes(status)) 
        {
            return res.status(400).json({ message: 'Status inválido!' });
        }

        const order = await service.update(id, { status, observations });
        if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

        return res.json(order);
    } 
    catch (error: any) 
    {
        return res.status(500).json({ message: error.message || 'Erro interno ao atualizar o pedido.' });
    }
}

export async function deleteOrder(req: Request<{id: string }>, res: Response) {
    const { id } = req.params;

    try 
    {
        const deleted = await service.deleteById(id);
        if (!deleted) return res.status(404).json({ message: 'Pedido não encontrado' });

        return res.status(200).json({ message: 'Pedido deletado com sucesso!' });
    } 
    catch (error) 
    {
        return res.status(500).json({ message: 'Erro interno ao deletar o pedido.' });
    }
}
