"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const order_schema_1 = require("./order.schema");
let OrderService = class OrderService {
    constructor(orderModel) {
        this.orderModel = orderModel;
    }
    calcularTotal(items) {
        return items.reduce((total, item) => total + item.quantity * item.price, 0);
    }
    async create(userId, restaurantId, createOrderDto) {
        const totalValue = this.calcularTotal(createOrderDto.items);
        const order = new this.orderModel({
            ...createOrderDto,
            userId: new mongoose_2.Types.ObjectId(userId),
            restaurantId: new mongoose_2.Types.ObjectId(restaurantId),
            totalValue,
        });
        return order.save();
    }
    async findOne(id, userId, restaurantId) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('ID inválido');
        }
        const order = await this.orderModel.findOne({
            _id: new mongoose_2.Types.ObjectId(id),
            userId: new mongoose_2.Types.ObjectId(userId),
            restaurantId: new mongoose_2.Types.ObjectId(restaurantId),
        });
        if (!order) {
            throw new common_1.NotFoundException('Pedido não encontrado');
        }
        return order;
    }
    async findAllByRestaurant(restaurantId) {
        return this.orderModel
            .find({ restaurantId: new mongoose_2.Types.ObjectId(restaurantId) })
            .sort({ createdAt: -1 })
            .limit(100)
            .exec();
    }
    async findAllByUser(userId) {
        return this.orderModel
            .find({ userId: new mongoose_2.Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(100)
            .exec();
    }
    async updateStatus(id, userId, restaurantId, status) {
        const order = await this.orderModel.findOneAndUpdate({
            _id: new mongoose_2.Types.ObjectId(id),
            restaurantId: new mongoose_2.Types.ObjectId(restaurantId),
        }, { status }, { new: true });
        if (!order) {
            throw new common_1.NotFoundException('Pedido não encontrado');
        }
        return order;
    }
    async remove(id, restaurantId) {
        const result = await this.orderModel.deleteOne({
            _id: new mongoose_2.Types.ObjectId(id),
            restaurantId: new mongoose_2.Types.ObjectId(restaurantId),
        });
        if (result.deletedCount === 0) {
            throw new common_1.NotFoundException('Pedido não encontrado');
        }
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(order_schema_1.Order.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OrderService);
//# sourceMappingURL=order.service.js.map