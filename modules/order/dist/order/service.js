"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const mongoose_1 = require("mongoose");
const model_1 = require("./model");
class OrderService {
    calcularTotal(items) {
        if (items.some(item => item.quantity <= 0 || item.price < 0))
            throw new Error('Itens inválidos no pedido');
        return items.reduce((total, item) => total + item.quantity * item.price, 0); // Calcula o valor total somando quantidade * preço de cada item
    }
    async create(data) {
        if (!data.restaurantId)
            throw new Error('Por favor, informe o restaurante!');
        if (!data.items || data.items.length === 0)
            throw new Error('O pedido deve ter ao menos um item!');
        const totalValue = this.calcularTotal(data.items);
        const order = new model_1.OrderModel({
            restaurantId: data.restaurantId,
            items: data.items,
            totalValue,
            origin: data.origin,
            observations: data.observations,
        });
        return order.save();
    }
    async getById(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id))
            return null;
        return model_1.OrderModel.findById(id);
    }
    async getAll() {
        return model_1.OrderModel.find().limit(100).sort({ createdAt: -1 });
    }
    async getAllByRestaurantId(restaurantId) {
        return model_1.OrderModel.find({ restaurantId }).limit(100).sort({ createdAt: -1 });
    }
    async update(id, data) {
        const updateData = {};
        if (!mongoose_1.Types.ObjectId.isValid(id))
            return null;
        if (!data || Object.keys(data).length === 0)
            throw new Error('Nenhum dado para atualizar');
        if (data.status) {
            const allowedStatus = ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
            if (!allowedStatus.includes(data.status))
                throw new Error('Status inválido!');
            updateData.status = data.status;
        }
        if (data.observations !== undefined) {
            updateData.observations = data.observations;
        }
        return model_1.OrderModel.findByIdAndUpdate(id, updateData, { new: true });
    }
    async deleteById(id) {
        if (!mongoose_1.Types.ObjectId.isValid(id))
            return null;
        const deleted = await model_1.OrderModel.findByIdAndDelete(id);
        return deleted;
    }
}
exports.OrderService = OrderService;
