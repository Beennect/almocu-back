import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BillSplit } from './bill-split.schema';
import { Order } from '../order/order.schema';
import { CreateBillSplitDto } from './dto/create-bill-split.dto';
import { StripeService } from '../stripe/stripe.service';
import { Pageable, Page, RedisService } from '@app/common';

@Injectable()
export class BillSplitService {
  private readonly logger = new Logger(BillSplitService.name);

  private readonly realtimeChannel = (restaurantId: string) =>
    `realtime:${restaurantId}`;

  constructor(
    @InjectModel(BillSplit.name) private billSplitModel: Model<BillSplit>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    restaurantId: string,
    createBillSplitDto: CreateBillSplitDto,
  ): Promise<BillSplit> {
    const { orderId, items, clientName } = createBillSplitDto;

    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('ID do pedido inválido');
    }

    // 1. Buscar o pedido e validar
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        restaurantId: new Types.ObjectId(restaurantId),
      })
      .lean()
      .exec();

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (order.status === 'cancelado') {
      throw new BadRequestException('Não é possível dividir um pedido cancelado');
    }

    // 2. Calcular total dos itens solicitados neste split
    const splitItems: Array<{
      productId: Types.ObjectId;
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }> = [];

    let totalValue = 0;

    for (const itemDto of items) {
      const orderItem = order.items.find(
        (i) => i.productId.toString() === itemDto.productId,
      );

      if (!orderItem) {
        throw new BadRequestException(
          `Item ${itemDto.productId} não encontrado no pedido`,
        );
      }

      if (itemDto.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Quantidade solicitada para "${orderItem.name}" excede a quantidade do pedido`,
        );
      }

      const subtotal = orderItem.price * itemDto.quantity;
      totalValue += subtotal;

      splitItems.push({
        productId: orderItem.productId,
        name: orderItem.name,
        quantity: itemDto.quantity,
        price: orderItem.price,
        subtotal,
      });
    }

    // 3. Criar o split
    const billSplit = new this.billSplitModel({
      orderId: new Types.ObjectId(orderId),
      restaurantId,
      items: splitItems,
      totalValue,
      clientName,
      paymentStatus: 'pending',
    });

    const saved = await billSplit.save();

    this.publishEvent(restaurantId, 'bill-split:created', saved);

    return saved;
  }

  async findByOrder(
    orderId: string,
    restaurantId: string,
  ): Promise<BillSplit[]> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('ID do pedido inválido');
    }

    const splits = await this.billSplitModel
      .find({
        orderId: new Types.ObjectId(orderId),
        restaurantId,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return splits as unknown as BillSplit[];
  }

  async findAllByRestaurant(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<BillSplit>> {
    const [items, total] = await Promise.all([
      this.billSplitModel
        .find({ restaurantId })
        .sort({ createdAt: -1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.billSplitModel.countDocuments({ restaurantId }).exec(),
    ]);

    return new Page(items as unknown as BillSplit[], total, pageable);
  }

  async pay(
    splitId: string,
    restaurantId: string,
  ): Promise<{ url: string; sessionId: string }> {
    if (!Types.ObjectId.isValid(splitId)) {
      throw new BadRequestException('ID do split inválido');
    }

    const split = await this.billSplitModel
      .findOne({
        _id: new Types.ObjectId(splitId),
        restaurantId,
      })
      .exec();

    if (!split) {
      throw new NotFoundException('Split não encontrado');
    }

    if (split.paymentStatus !== 'pending') {
      throw new BadRequestException(
        `Este split já está com status "${split.paymentStatus}"`,
      );
    }

    // Criar sessão no Stripe
    const items = split.items.map((item) => ({
      name: item.name,
      amount: Math.round(item.subtotal * 100), // Stripe usa centavos
      quantity: 1, // Já calculamos o subtotal com a quantidade
    }));

    const session = await this.stripeService.createCheckoutSession(items);

    // Atualizar o split com o sessionId
    split.stripeSessionId = session.sessionId;
    await split.save();

    return { url: session.url || '', sessionId: session.sessionId };
  }

  async confirmPayment(
    sessionId: string,
    restaurantId: string,
  ): Promise<BillSplit> {
    const split = await this.billSplitModel
      .findOne({
        stripeSessionId: sessionId,
        restaurantId,
      })
      .exec();

    if (!split) {
      throw new NotFoundException('Split não encontrado para esta sessão');
    }

    if (split.paymentStatus !== 'pending') {
      return split; // Já foi confirmado
    }

    // Verificar status no Stripe
    const result = await this.stripeService.verifySession(sessionId);

    if (result.paymentStatus === 'paid') {
      split.paymentStatus = 'paid';
      await split.save();

      // Verificar se todos os splits do pedido estão pagos
      await this.checkAndUpdateOrderPayment(split.orderId.toString(), restaurantId);

      this.publishEvent(restaurantId, 'bill-split:paid', split);
    }

    return split;
  }

  async cancel(
    splitId: string,
    restaurantId: string,
  ): Promise<BillSplit> {
    if (!Types.ObjectId.isValid(splitId)) {
      throw new BadRequestException('ID do split inválido');
    }

    const split = await this.billSplitModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(splitId),
          restaurantId,
          paymentStatus: { $in: ['pending', 'paid'] },
        },
        { $set: { paymentStatus: 'canceled' } },
        { new: true },
      )
      .exec();

    if (!split) {
      throw new NotFoundException(
        'Split não encontrado ou não pode ser cancelado',
      );
    }

    this.publishEvent(restaurantId, 'bill-split:canceled', split);

    return split;
  }

  /**
   * Verifica se todos os splits de um pedido estão pagos.
   * Se sim, atualiza o paymentStatus do pedido para 'paid'.
   */
  private async checkAndUpdateOrderPayment(
    orderId: string,
    restaurantId: string,
  ): Promise<void> {
    const pendingSplits = await this.billSplitModel
      .countDocuments({
        orderId: new Types.ObjectId(orderId),
        paymentStatus: { $nin: ['paid'] },
      })
      .exec();

    if (pendingSplits === 0) {
      await this.orderModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(orderId),
            restaurantId: new Types.ObjectId(restaurantId),
          },
          {
            $set: { paymentStatus: 'paid' },
          },
        )
        .exec();
    }
  }

  private async publishEvent(
    restaurantId: string,
    type: string,
    payload: any,
  ): Promise<void> {
    const channel = this.realtimeChannel(restaurantId);
    const message = JSON.stringify({ type, payload });
    await this.redisService.publish(channel, message).catch((err) => {
      this.logger.error(
        `Failed to publish event ${type}: ${(err as Error).message}`,
      );
    });
  }
}
