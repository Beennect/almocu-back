"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModel = void 0;
const mongoose_1 = require("mongoose");
const OrderItemSchema = new mongoose_1.Schema({
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    observations: { type: String, maxlength: 500 },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    restaurantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    items: {
        type: [OrderItemSchema],
        required: true,
        validate: {
            validator: (items) => items.length > 0,
            message: 'O pedido deve ter ao menos um item!'
        }
    },
    totalValue: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        required: true,
        default: 'pendente',
        enum: ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'],
    },
    origin: { type: String, maxlength: 50 },
    observations: { type: String, maxlength: 500 },
}, { timestamps: true });
exports.OrderModel = (0, mongoose_1.model)('Order', OrderSchema);
//# sourceMappingURL=model.js.map