import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(@InjectModel(Order.name) private orderModel: Model<Order>) {}

  private calcularTotal(items: any[]): number {
    return items.reduce((total, item) => total + item.quantity * item.price, 0);
  }

  async create(userId: string, restaurantId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const totalValue = this.calcularTotal(createOrderDto.items);

    const order = new this.orderModel({
      ...createOrderDto,
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
      totalValue,
    });

    return order.save();
  }

  async findOne(id: string, userId: string, restaurantId: string): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return order;
  }

  async findAllByRestaurant(restaurantId: string): Promise<Order[]> {
    return this.orderModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  async findAllByUser(userId: string): Promise<Order[]> {
    return this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  async updateStatus(id: string, userId: string, restaurantId: string, status: string): Promise<Order> {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        restaurantId: new Types.ObjectId(restaurantId),
      },
      { status },
      { new: true },
    );

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return order;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const result = await this.orderModel.deleteOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Pedido não encontrado');
    }
  }
}
