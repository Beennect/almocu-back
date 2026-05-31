import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Pageable, Page } from '@app/common';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    userId: string,
    role: string,
    restaurantId: string,
    createOrderDto: CreateOrderDto,
    token: string,
  ): Promise<Order> {
    const productIds = createOrderDto.items.map((item) => item.productId);

    const menuServiceUrl =
      this.configService.get<string>('MENU_SERVICE_URL') ||
      'http://menu-app:3000';

    const stockServiceUrl =
      this.configService.get<string>('STOCK_SERVICE_URL') ||
      'http://stock-app:3000';

    const internalKey = this.configService.get<string>('INTERNAL_API_KEY');

    try {
      // 1. Busca os produtos no serviço de Menu
      let products: any[];
      try {
        const response = await firstValueFrom(
          this.httpService
            .post(
              `${menuServiceUrl}/products/batch`,
              { ids: productIds },
              {
                headers: {
                  Authorization: token,
                  'x-tenant-id': restaurantId,
                  'x-user-role': role,
                  'x-internal-key': internalKey,
                },
              },
            )
            .pipe(timeout(10000)),
        );
        products = response.data;
      } catch (error: any) {
        const detail =
          error?.response?.data?.message ||
          error?.message ||
          'Erro ao conectar com serviço de cardápio';
        this.logger.error(`Falha ao buscar produtos: ${detail}`);
        throw new BadRequestException(`Cardápio indisponível: ${detail}`);
      }

      if (products.length !== productIds.length) {
        const foundIds = products.map((p: any) => p._id.toString());
        const missingIds = productIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `Produtos não encontrados: ${missingIds.join(', ')}`,
        );
      }

      // 2. Monta o pedido com os dados dos produtos
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p]),
      );

      let totalValue = 0;
      const items = createOrderDto.items.map((itemDto) => {
        const product = productMap.get(itemDto.productId);
        if (!product) {
          throw new BadRequestException(
            `Produto ${itemDto.productId} não encontrado no cardápio`,
          );
        }
        const itemTotal = product.price * itemDto.quantity;
        totalValue += itemTotal;

        return {
          productId: product._id,
          name: product.name,
          quantity: itemDto.quantity,
          price: product.price,
        };
      });

      // 3. Salva o pedido PRIMEIRO (status pendente)
      //    Isso garante que, mesmo se o estoque falhar, o pedido existe para reconciliação
      let order: Order;
      try {
        order = await new this.orderModel({
          items,
          deliveryAddress: createOrderDto.deliveryAddress,
          origin: createOrderDto.origin,
          observations: createOrderDto.observations,
          userId: new Types.ObjectId(userId),
          restaurantId: new Types.ObjectId(restaurantId),
          totalValue,
        }).save();
      } catch (saveError: any) {
        this.logger.error(
          `Falha ao salvar pedido: ${saveError?.message || saveError}`,
        );
        throw new BadRequestException(
          'Erro ao salvar pedido. Verifique os dados e tente novamente.',
        );
      }

      // 4. Ajusta o estoque de TODOS os ingredientes em paralelo
      const adjustments: Array<{
        stockProductId: string;
        delta: number;
      }> = [];

      for (const itemDto of createOrderDto.items) {
        const product = productMap.get(itemDto.productId);
        if (!product?.ingredients?.length) continue;

        for (const ingredient of product.ingredients) {
          adjustments.push({
            stockProductId: ingredient.stockProductId,
            delta: -(ingredient.quantity * itemDto.quantity),
          });
        }
      }

      if (adjustments.length > 0) {
        try {
          // Processa TODOS os ajustes em paralelo
          await Promise.all(
            adjustments.map((adj) =>
              firstValueFrom(
                this.httpService
                  .patch(
                    `${stockServiceUrl}/stock/${adj.stockProductId}/adjust`,
                    { delta: adj.delta },
                    {
                      headers: {
                        Authorization: token,
                        'x-tenant-id': restaurantId,
                        'x-user-role': role,
                        'x-internal-key': internalKey,
                      },
                    },
                  )
                  .pipe(timeout(10000)),
              ),
            ),
          );
        } catch (stockError: unknown) {
          // Rollback paralelo de todos os ajustes
          this.logger.error(
            `Falha no ajuste de estoque para o pedido ${(order as any)._id}. Iniciando rollback...`,
          );

          await Promise.allSettled(
            adjustments.map((adj) =>
              firstValueFrom(
                this.httpService
                  .patch(
                    `${stockServiceUrl}/stock/${adj.stockProductId}/adjust`,
                    { delta: -adj.delta },
                    {
                      headers: {
                        Authorization: token,
                        'x-tenant-id': restaurantId,
                        'x-user-role': role,
                        'x-internal-key': internalKey,
                      },
                    },
                  )
                  .pipe(timeout(10000)),
              ),
            ),
          );

          const message =
            (stockError as any)?.response?.data?.message ||
            'Falha ao ajustar estoque para um ingrediente';
          throw new BadRequestException(message);
        }
      }

      return order;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        this.logger.error(
          `Erro inesperado ao processar pedido: ${error.message}`,
        );
      }
      throw new BadRequestException('Erro ao processar pedido');
    }
  }

  async findOne(
    id: string,
    userId: string,
    role: string,
    restaurantId: string,
  ): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID do pedido inválido');
    }
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('restaurantId inválido');
    }

    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    };

    // WAITER só vê os próprios pedidos
    if (role === 'WAITER') {
      filter.userId = new Types.ObjectId(userId);
    }

    const order = await this.orderModel.findOne(filter).lean().exec();

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return order as unknown as Order;
  }

  async findAllByRestaurant(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<Order>> {
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('restaurantId inválido');
    }

    const [items, total] = await Promise.all([
      this.orderModel
        .find({ restaurantId: new Types.ObjectId(restaurantId) })
        .sort({ createdAt: -1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.orderModel
        .countDocuments({ restaurantId: new Types.ObjectId(restaurantId) })
        .exec(),
    ]);

    return new Page(items as unknown as Order[], total, pageable);
  }

  async findAllByUser(
    userId: string,
    pageable: Pageable,
  ): Promise<Page<Order>> {
    const [items, total] = await Promise.all([
      this.orderModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.orderModel
        .countDocuments({ userId: new Types.ObjectId(userId) })
        .exec(),
    ]);

    return new Page(items as unknown as Order[], total, pageable);
  }

  async updateStatus(
    id: string,
    restaurantId: string,
    status: string,
    role: string,
  ): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID do pedido inválido');
    }
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('restaurantId inválido');
    }

    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(id),
        restaurantId: new Types.ObjectId(restaurantId),
      })
      .exec();

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    // Valida transição permitida por role
    const allowedTransitions: Record<string, string[]> = {
      KITCHEN: ['em_preparo', 'pronto'],
      DELIVERY: ['saiu_para_entrega', 'entregue'],
      OWNER: [
        'em_preparo',
        'pronto',
        'saiu_para_entrega',
        'entregue',
        'cancelado',
      ],
      MANAGER: [
        'em_preparo',
        'pronto',
        'saiu_para_entrega',
        'entregue',
        'cancelado',
      ],
    };

    const allowed = allowedTransitions[role];
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(
        `Função "${role}" não pode alterar para o status "${status}"`,
      );
    }

    // KITCHEN só pode avançar: pendente → em_preparo → pronto
    if (role === 'KITCHEN') {
      const valid =
        (order.status === 'pendente' && status === 'em_preparo') ||
        (order.status === 'em_preparo' && status === 'pronto');
      if (!valid) {
        throw new BadRequestException(
          `Cozinheiros só podem alterar de "${order.status}" para "em_preparo" ou "pronto"`,
        );
      }
    }

    // DELIVERY só pode: pronto → sai_para_entrega → entregue
    if (role === 'DELIVERY') {
      const valid =
        (order.status === 'pronto' && status === 'saiu_para_entrega') ||
        (order.status === 'saiu_para_entrega' && status === 'entregue');
      if (!valid) {
        throw new BadRequestException(
          `Entregadores só podem alterar de "${order.status}" para "saiu_para_entrega" ou "entregue"`,
        );
      }
    }

    order.status = status;
    return order.save();
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID do pedido inválido');
    }
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('restaurantId inválido');
    }

    const result = await this.orderModel.deleteOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Pedido não encontrado');
    }
  }
}
