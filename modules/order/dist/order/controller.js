"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.getOrderById = getOrderById;
exports.getAllOrders = getAllOrders;
exports.getAllUserOrders = getAllUserOrders;
exports.updateOrder = updateOrder;
exports.deleteOrder = deleteOrder;
const service_1 = require("./service");
const service = new service_1.OrderService();
const getAuthData = (req) => {
    const user = req.user;
    if (!user || !user._id) {
        throw new Error("Usuário não autenticado ou token inválido");
    }
    return {
        userId: user._id,
        restaurantId: user.restaurantId,
    };
};
async function createOrder(req, res) {
    const { items, origin, observations } = req.body;
    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId)
            return res.status(400).json({ message: "ID do restaurante não encontrado no token" });
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Por favor, preencha os dados obrigatórios!' });
        }
        const order = await service.create({ restaurantId, userId, items, origin, observations });
        return res.status(201).json(order);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || 'Erro interno ao criar o pedido.' });
    }
}
async function getOrderById(req, res) {
    const { id } = req.params;
    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId)
            return res.status(400).json({ message: "ID do restaurante não encontrado no token" });
        const order = await service.getById(id, userId, restaurantId);
        if (!order)
            return res.status(404).json({ message: 'Pedido não encontrado' });
        return res.json(order);
    }
    catch (error) {
        return res.status(500).json({ message: 'Erro interno na busca do pedido.' });
    }
}
async function getAllOrders(req, res) {
    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId)
            return res.status(400).json({ message: "ID do restaurante não encontrado no token" });
        const orders = await service.getAllByRestaurantId(userId, restaurantId);
        if (orders.length === 0)
            return res.json(orders);
        return res.json(orders);
    }
    catch (error) {
        return res.status(500).json({ message: 'Erro interno na busca dos pedidos.' });
    }
}
async function getAllUserOrders(req, res) {
    try {
        const { userId } = getAuthData(req);
        const orders = await service.getAllFromUser(userId);
        if (orders.length === 0)
            return res.json(orders);
        return res.json(orders);
    }
    catch (error) {
        return res.status(500).json({ message: 'Erro interno na busca dos pedidos.' });
    }
}
async function updateOrder(req, res) {
    const { id } = req.params;
    const { status, observations } = req.body;
    const allowedStatus = ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId)
            return res.status(400).json({ message: "ID do restaurante não encontrado no token" });
        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({ message: 'Status inválido!' });
        }
        const order = await service.update(id, userId, restaurantId, { status, observations });
        if (!order)
            return res.status(404).json({ message: 'Pedido não encontrado' });
        return res.json(order);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || 'Erro interno ao atualizar o pedido.' });
    }
}
async function deleteOrder(req, res) {
    const { id } = req.params;
    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId)
            return res.status(400).json({ message: "ID do restaurante não encontrado no token" });
        const deleted = await service.deleteById(id, userId, restaurantId);
        if (!deleted)
            return res.status(404).json({ message: 'Pedido não encontrado' });
        return res.status(200).json({ message: 'Pedido deletado com sucesso!' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Erro interno ao deletar o pedido.' });
    }
}
