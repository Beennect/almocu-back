import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, restaurantId: string, createOrderDto: CreateOrderDto, token: string): Promise<Order> {
    const productIds = createOrderDto.items.map(item => item.productId);
    
    // Busca os produtos no serviço de Menu via HTTP
    const menuServiceUrl = this.configService.get<string>('MENU_SERVICE_URL') || 'http://menu-app:3000';
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${menuServiceUrl}/products/batch`, 
          { ids: productIds },
          { headers: { Authorization: token } }
        )
      );

      const products = response.data;

      if (products.length !== productIds.length) {
        throw new BadRequestException('Um ou mais produtos não foram encontrados no cardápio');
      }

      // Mapeia os itens com os dados reais do menu
      let totalValue = 0;
      const items = createOrderDto.items.map(itemDto => {
        const product = products.find(p => p._id.toString() === itemDto.productId);
        const itemTotal = product.price * itemDto.quantity;
        totalValue += itemTotal;
        
        return {
          productId: product._id,
          name: product.name,
          quantity: itemDto.quantity,
          price: product.price,
        };
      });

      const order = new this.orderModel({
        ...createOrderDto,
        items,
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        totalValue,
      });

      return order.save();
    } catch (error) {
      console.error('Erro ao buscar produtos no menu:', error.message);
      throw new BadRequestException('Erro ao validar produtos no serviço de menu');
    }
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
