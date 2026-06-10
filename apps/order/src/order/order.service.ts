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
import { Pageable, Page, RedisService } from '@app/common';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  private readonly realtimeChannel = (restaurantId: string) =>
    `realtime:${restaurantId}`;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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

      // Usa Set para deduplicar — o batch endpoint retorna produtos únicos
      const uniqueProductIds = [...new Set(productIds)];
      if (products.length !== uniqueProductIds.length) {
        const foundIds = products.map((p: any) => p._id.toString());
        const missingIds = uniqueProductIds.filter((id) => !foundIds.includes(id));
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

      // 3. Calcula os ajustes de estoque necessários (ingredientes × quantidade pedida)
      //    Já mescla por stockProductId para evitar duplicatas no envio batch
      const adjustmentMap = new Map<string, number>();

      for (const itemDto of createOrderDto.items) {
        const product = productMap.get(itemDto.productId);
        if (!product?.ingredients?.length) continue;

        for (const ingredient of product.ingredients) {
          const delta = -(ingredient.quantity * itemDto.quantity);
          adjustmentMap.set(
            ingredient.stockProductId,
            (adjustmentMap.get(ingredient.stockProductId) || 0) + delta,
          );
        }
      }

      const adjustments = Array.from(adjustmentMap.entries()).map(
        ([stockProductId, delta]) => ({ stockProductId, delta }),
      );

      // 4. VALIDA o estoque ANTES de criar o pedido
      if (adjustments.length > 0) {
        // Agrupa por stockProductId (um ingrediente pode aparecer em vários produtos)
        const neededMap = new Map<string, { needed: number; name: string }>();
        for (const adj of adjustments) {
          const current = neededMap.get(adj.stockProductId) || {
            needed: 0,
            name: adj.stockProductId, // será substituído pelo nome real vindo do estoque
          };
          current.needed += Math.abs(adj.delta);
          neededMap.set(adj.stockProductId, current);
        }

        // Busca TODOS os itens de estoque em uma única chamada via endpoint interno
        const stockIds = Array.from(neededMap.keys());
        let stockItems: any[] = [];
        try {
          const resp = await firstValueFrom(
            this.httpService
              .post(
                `${stockServiceUrl}/internal/stock/batch`,
                { ids: stockIds },
                {
                  headers: {
                    'x-internal-key': internalKey,
                    'x-tenant-id': restaurantId,
                  },
                },
              )
              .pipe(timeout(10000)),
          );
          stockItems = resp.data;
        } catch {
          throw new BadRequestException(
            'Não foi possível consultar o estoque. Tente novamente.',
          );
        }

        // Monta mapa de disponibilidade
        const availableMap = new Map<string, any>();
        for (const item of stockItems) {
          availableMap.set(item._id.toString(), item);
        }

        // Verifica cada ingrediente
        const insufficient: string[] = [];
        for (const [stockId, info] of neededMap) {
          const stockItem = availableMap.get(stockId);
          if (!stockItem) {
            insufficient.push(`${info.name}: item não encontrado no estoque`);
            continue;
          }
          const available = stockItem.quantity ?? 0;
          if (available < info.needed) {
            insufficient.push(
              `${stockItem.name || info.name}`,
            );
          }
        }

        if (insufficient.length > 0) {
          throw new BadRequestException(
            `Estoque insuficiente: ${insufficient.join('; ')}`,
          );
        }
      }

      // 5. Cria o pedido (estoque já validado)
      let order: Order;

      // Validar tableId se fornecido
      let tableId: Types.ObjectId | undefined;
      if (createOrderDto.tableId) {
        if (!Types.ObjectId.isValid(createOrderDto.tableId)) {
          throw new BadRequestException('ID da mesa inválido');
        }
        tableId = new Types.ObjectId(createOrderDto.tableId);
      }

      // Se o criador é DELIVERY e não informou deliveryUserId, auto-atribui
      const deliveryUserId =
        createOrderDto.deliveryUserId
          ? new Types.ObjectId(createOrderDto.deliveryUserId)
          : role === 'DELIVERY'
            ? new Types.ObjectId(userId)
            : undefined;

      try {
        order = await new this.orderModel({
          items,
          deliveryAddress: createOrderDto.deliveryAddress,
          clientName: createOrderDto.clientName,
          origin: createOrderDto.origin,
          observations: createOrderDto.observations,
          userId: new Types.ObjectId(userId),
          restaurantId: new Types.ObjectId(restaurantId),
          totalValue,
          deliveryUserId,
          tableId,
          statusHistory: [{ status: 'pendente', timestamp: new Date() }],
        }).save();
      } catch (saveError: any) {
        this.logger.error(
          `Falha ao salvar pedido: ${saveError?.message || saveError}`,
        );
        throw new BadRequestException(
          'Erro ao salvar pedido. Verifique os dados e tente novamente.',
        );
      }

      // 6. Deduz o estoque (chamada batch única)
      if (adjustments.length > 0) {
        try {
          await firstValueFrom(
            this.httpService
              .post(
                `${stockServiceUrl}/internal/stock/batch/adjust`,
                { adjustments: adjustments.map((a) => ({ id: a.stockProductId, delta: a.delta })) },
                {
                  headers: {
                    'x-internal-key': internalKey,
                    'x-tenant-id': restaurantId,
                  },
                },
              )
              .pipe(timeout(15000)),
          );
        } catch (stockError: unknown) {
          // Rollback: como o estoque já foi validado antes, isso só ocorre
          // se houve concorrência (dois pedidos simultâneos).
          this.logger.error(
            `Falha na dedução de estoque do pedido ${(order as any)._id}. Rollback...`,
          );

          // Rollback usando batch adjust com deltas invertidos
          try {
            await firstValueFrom(
              this.httpService
                .post(
                  `${stockServiceUrl}/internal/stock/batch/adjust`,
                  {
                    adjustments: adjustments.map((a) => ({
                      id: a.stockProductId,
                      delta: -a.delta,
                    })),
                  },
                  {
                    headers: {
                      'x-internal-key': internalKey,
                      'x-tenant-id': restaurantId,
                    },
                  },
                )
                .pipe(timeout(15000)),
            );
          } catch (rollbackError: unknown) {
            this.logger.error(
              `Rollback de estoque também falhou para pedido ${(order as any)._id}: ${(rollbackError as any)?.message}`,
            );
          }

          const message =
            (stockError as any)?.response?.data?.message ||
            'Falha ao ajustar estoque. O pedido foi criado mas o estoque não pôde ser deduzido. Contate o administrador.';
          // O pedido já foi criado — lançamos o erro para o front-end tratar
          throw new BadRequestException(message);
        }
      }

      // Emite evento de tempo real
      this.publishEvent(restaurantId, 'order:created', order);

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

  /**
   * Agrega estatísticas de performance por usuário em um restaurante.
   * Retorna total de pedidos, receita, total de itens preparados para cada userId.
   */
  async getStaffPerformance(
    restaurantId: string,
  ): Promise<
    Array<{
      userId: string;
      totalOrders: number;
      totalRevenue: number;
      dishesPrepared: number;
    }>
  > {
    const stats = await this.orderModel
      .aggregate([
        { $match: { restaurantId: new Types.ObjectId(restaurantId) } },
        {
          $group: {
            _id: '$userId',
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ['$totalValue', 0] } },
            dishesPrepared: {
              $sum: { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: '$$item.quantity' } } },
            },
          },
        },
        {
          $project: {
            userId: { $toString: '$_id' },
            totalOrders: 1,
            totalRevenue: { $round: ['$totalRevenue', 2] },
            dishesPrepared: 1,
            _id: 0,
          },
        },
      ])
      .exec();

    return stats;
  }

  async findAllByUser(
    userId: string,
    pageable: Pageable,
    role?: string,
    restaurantId?: string,
  ): Promise<Page<Order>> {
    let filter: Record<string, any>;

    if (role === 'DELIVERY') {
      if (!restaurantId) {
        throw new BadRequestException('restaurantId é obrigatório');
      }
      // DELIVERY vê pedidos do restaurante:
      // - atribuídos a ele, OU
      // - PRONTO com deliveryAddress e NÃO atribuídos a ninguém (disponíveis)
      filter = {
        restaurantId: new Types.ObjectId(restaurantId),
        $or: [
          { deliveryUserId: new Types.ObjectId(userId) },
          {
            status: 'pronto',
            deliveryAddress: { $exists: true, $ne: null },
            deliveryUserId: { $exists: false },
          },
        ],
      };
    } else {
      filter = { userId: new Types.ObjectId(userId) };
    }

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.orderModel
        .countDocuments(filter)
        .exec(),
    ]);

    return new Page(items as unknown as Order[], total, pageable);
  }

  async updateStatus(
    id: string,
    restaurantId: string,
    status: string,
    role: string,
    userId: string,
    deliveryUserId?: string,
  ): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID do pedido inválido');
    }
    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('restaurantId inválido');
    }

    // Valida transição permitida por role
    const allowedTransitions: Record<string, string[]> = {
      KITCHEN: ['em_preparo', 'pronto'],
      DELIVERY: ['saiu_para_entrega', 'entregue'],
      CASHIER: ['pronto', 'entregue'],
      WAITER: ['pronto', 'entregue'],
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

    // Converte IDs para ObjectId
    const orderId = new Types.ObjectId(id);
    const restId = new Types.ObjectId(restaurantId);
    const userIdObj = new Types.ObjectId(userId);

    // Define o deliveryUserId para a transição
    let assignedDeliveryUserId: Types.ObjectId | undefined;
    if (deliveryUserId) {
      assignedDeliveryUserId = new Types.ObjectId(deliveryUserId);
    } else if (role === 'DELIVERY' && status === 'saiu_para_entrega') {
      // Auto-assign para o entregador logado
      assignedDeliveryUserId = userIdObj;
    }

    const statusEntry = { status, timestamp: new Date() };

    // --- Validações específicas por role + atualização ---

    // Helper para validação de transição
    const validateTransition = async (validChecks: Array<{ from: string; to: string }>): Promise<void> => {
      const order = await this.orderModel.findOne({
        _id: orderId,
        restaurantId: restId,
      }).exec();
      if (!order) throw new NotFoundException('Pedido não encontrado');

      const isValid = validChecks.some(
        (c) => order.status === c.from && status === c.to,
      );
      if (!isValid) {
        const transitions = validChecks.map((c) => `"${c.from}" → "${c.to}"`).join(' ou ');
        throw new BadRequestException(
          `${role} só pode alterar de ${transitions}`,
        );
      }
    };

    if (role === 'KITCHEN') {
      await validateTransition([
        { from: 'pendente', to: 'em_preparo' },
        { from: 'em_preparo', to: 'pronto' },
      ]);
    } else if (role === 'CASHIER') {
      await validateTransition([
        { from: 'em_preparo', to: 'pronto' },
        { from: 'pronto', to: 'entregue' },
      ]);
    } else if (role === 'WAITER') {
      await validateTransition([
        { from: 'pronto', to: 'entregue' },
        { from: 'em_preparo', to: 'pronto' },
      ]);
      // Apenas pedidos de balcão (sem endereço de entrega)
      const waiterOrder = await this.orderModel.findOne({
        _id: orderId,
        restaurantId: restId,
      }).exec();
      if (!waiterOrder) {
        throw new NotFoundException('Pedido não encontrado');
      }
      if (waiterOrder.deliveryAddress || waiterOrder.deliveryUserId) {
        throw new BadRequestException(
          'Garçom só pode finalizar pedidos de balcão',
        );
      }
      // Apenas pedidos criados pelo próprio garçom
      if (waiterOrder.userId.toString() !== userId) {
        throw new BadRequestException(
          'Você só pode finalizar seus próprios pedidos',
        );
      }
    } else if (role === 'DELIVERY') {
      await validateTransition([
        { from: 'pronto', to: 'saiu_para_entrega' },
        { from: 'saiu_para_entrega', to: 'entregue' },
      ]);

      // Transição PRONTO → SAIU_PARA_ENTREGA: findOneAndUpdate atômico
      // previne race condition (dois entregadores pegarem o mesmo pedido)
      if (status === 'saiu_para_entrega') {
        const updated = await this.orderModel
          .findOneAndUpdate(
            {
              _id: orderId,
              restaurantId: restId,
              status: 'pronto',
              deliveryUserId: { $exists: false },
            },
            {
              $set: { status, deliveryUserId: assignedDeliveryUserId },
              $push: { statusHistory: statusEntry },
            },
            { new: true },
          )
          .exec();

        if (!updated) {
          const existingOrder = await this.orderModel.findById(orderId).exec();
          if (existingOrder?.deliveryUserId) {
            throw new BadRequestException(
              'Este pedido já foi atribuído a outro entregador',
            );
          }
          throw new BadRequestException(
            'Este pedido não está mais disponível para entrega',
          );
        }
        this.publishEvent(restaurantId, 'order:statusChanged', updated);
        return updated;
      }
      // SAIU_PARA_ENTREGA → ENTREGUE (sem lock necessário)
    }

    // Atualização padrão para KITCHEN, CASHIER, OWNER, MANAGER, DELIVERY (entregue)
    const setFields: Record<string, any> = { status };
    if (assignedDeliveryUserId) {
      setFields.deliveryUserId = assignedDeliveryUserId;
    }

    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, restaurantId: restId },
        { $set: setFields, $push: { statusHistory: statusEntry } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Pedido não encontrado');
    }

    this.publishEvent(restaurantId, 'order:statusChanged', updated);
    return updated;
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

    this.publishEvent(restaurantId, 'order:canceled', { id });
  }

  private async publishEvent(restaurantId: string, type: string, payload: any): Promise<void> {
    const channel = this.realtimeChannel(restaurantId);
    const message = JSON.stringify({ type, payload });
    await this.redisService.publish(channel, message).catch((err) => {
      this.logger.error(`Failed to publish event ${type}: ${(err as Error).message}`);
    });
  }
}
