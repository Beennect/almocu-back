import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Stock, StockDocument } from './stock.schema';
import { CreateStockDto, UpdateStockDto } from './dto/stock.dto';
import { Pageable, Page, RedisService } from '@app/common';
import { SupplierService } from '../supplier/supplier.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    private readonly supplierService: SupplierService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    createStockDto: CreateStockDto,
    restaurantId: string,
  ): Promise<Stock> {
    const name = createStockDto.name.trim();
    const brand = createStockDto.brand?.trim() || '';

    await this.validateSupplier(createStockDto.supplierId, restaurantId);

    const sanitizedSupplierId = createStockDto.supplierId || undefined;

    try {
      const created = new this.stockModel({
        ...createStockDto,
        supplierId: sanitizedSupplierId,
        name,
        brand,
        restaurantId,
      });
      const saved = await created.save();
      this.publishEvent(restaurantId, 'stock:changed', { action: 'create', item: saved });
      return saved;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(`O item "${name}" já existe nesta filial.`);
      }
      throw error;
    }
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
    active?: 'true' | 'false' | 'all',
  ): Promise<Page<Stock>> {
    const filter: Record<string, any> = { restaurantId };
    if (active !== 'all') {
      filter.isActive = active !== 'false';
    }

    const [items, total] = await Promise.all([
      this.stockModel
        .find(filter)
        .sort({ name: 1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.stockModel.countDocuments(filter).exec(),
    ]);

    return new Page(items, total, pageable);
  }

  async findOne(id: string, restaurantId: string): Promise<Stock> {
    this.validateObjectId(id);

    const item = await this.stockModel
      .findOne({ _id: id, restaurantId })
      .lean()
      .exec();
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }
    return item;
  }

  async update(
    id: string,
    updateStockDto: UpdateStockDto,
    restaurantId: string,
  ): Promise<Stock> {
    this.validateObjectId(id);
    await this.validateSupplier(updateStockDto.supplierId, restaurantId);

    const updateData: Record<string, unknown> = {};
    if (updateStockDto.name !== undefined) {
      updateData.name = updateStockDto.name.trim();
    }
    if (updateStockDto.brand !== undefined) {
      updateData.brand = updateStockDto.brand.trim() || '';
    }
    if (updateStockDto.unit !== undefined) {
      updateData.unit = updateStockDto.unit;
    }
    if (updateStockDto.quantity !== undefined) {
      updateData.quantity = updateStockDto.quantity;
    }
    if (updateStockDto.minQuantity !== undefined) {
      updateData.minQuantity = updateStockDto.minQuantity;
    }
    if (updateStockDto.supplierId) {
      updateData.supplierId = updateStockDto.supplierId;
    } else if (updateStockDto.supplierId === null) {
      updateData.supplierId = null;
    }
    if (updateStockDto.category !== undefined) {
      updateData.category = updateStockDto.category;
    }

    const updated = await this.stockModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    this.publishEvent(restaurantId, 'stock:changed', { action: 'update', item: updated });
    return updated;
  }

  async adjustQuantity(
    id: string,
    delta: number,
    restaurantId: string,
  ): Promise<Stock> {
    if (delta === 0) {
      throw new BadRequestException('Delta cannot be zero.');
    }
    this.validateObjectId(id);

    const filter =
      delta < 0
        ? { _id: id, restaurantId, quantity: { $gte: -delta } }
        : { _id: id, restaurantId };

    const updated = await this.stockModel
      .findOneAndUpdate(
        filter,
        { $inc: { quantity: delta } },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      // Verifica se o item existe (não encontrado vs estoque insuficiente)
      const exists = await this.stockModel.exists({ _id: id, restaurantId });
      if (exists) {
        throw new BadRequestException(
          `Estoque insuficiente para o item solicitado (ID: ${id}).`,
        );
      }
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    this.publishEvent(restaurantId, 'stock:changed', { action: 'adjust', item: updated });
    return updated;
  }

  async remove(id: string, restaurantId: string): Promise<{ affectedProducts: any[] }> {
    this.validateObjectId(id);
    this.validateObjectId(restaurantId, 'RestaurantId');

    // 1. Busca os produtos afetados antes de desativar
    let affectedProducts: any[] = [];
    try {
      const internalKey =
        this.configService.getOrThrow<string>('INTERNAL_API_KEY');
      const menuServiceUrl =
        this.configService.get<string>('MENU_SERVICE_URL') ||
        'http://menu-app:3000';

      const response = await firstValueFrom(
        this.httpService.get(
          `${menuServiceUrl}/products/internal/by-stock/${id}`,
          {
            headers: {
              'x-internal-key': internalKey,
              'x-tenant-id': restaurantId,
            },
            timeout: 5000,
          },
        ),
      );
      affectedProducts = response.data || [];
    } catch (error: any) {
      // Se o menu estiver indisponível, loga e continua sem produtos afetados
      this.logger.warn(
        `Menu service indisponível ao buscar produtos afetados por ${id}: ${error.message}`,
      );
    }

    // 2. Armazena as relações atuais antes de desativar
    const item = await this.stockModel
      .findOne({ _id: id, restaurantId })
      .exec();

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    const previousRelations = affectedProducts.map((p: any) => {
      const ingredient = (p.ingredients || []).find(
        (i: any) => i.stockProductId?.toString() === id || i.stockProductId === id,
      );
      return {
        productId: p._id,
        productName: p.name,
        quantity: ingredient?.quantity || 0,
      };
    });

    // 3. Desativa o item (soft delete) e salva as relações anteriores
    item.isActive = false;
    item.previousProductRelations = previousRelations;
    await item.save();

    this.publishEvent(restaurantId, 'stock:changed', { action: 'deactivate', id, affectedProducts });

    return { affectedProducts };
  }

  async reactivate(id: string, restaurantId: string): Promise<Stock> {
    this.validateObjectId(id);
    this.validateObjectId(restaurantId, 'RestaurantId');

    const updated = await this.stockModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: { isActive: true } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    this.publishEvent(restaurantId, 'stock:changed', { action: 'reactivate', id });
    return updated;
  }

  async publishEvent(restaurantId: string, type: string, payload: any): Promise<void> {
    try {
      await this.redisService.publish(
        `realtime:${restaurantId}`,
        JSON.stringify({ type, payload }),
      );
    } catch (err) {
      this.logger.error(`Failed to publish realtime event ${type}: ${(err as Error).message}`);
    }
  }

  private validateObjectId(id: string, fieldName = 'ID'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `O ${fieldName} informado não é um ID válido.`,
      );
    }
  }

  async findByIds(ids: string[], restaurantId: string): Promise<Stock[]> {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) return [];

    return this.stockModel
      .find({ _id: { $in: objectIds }, restaurantId })
      .lean()
      .exec();
  }

  private async validateSupplier(
    supplierId: string | undefined,
    restaurantId: string,
  ): Promise<void> {
    if (!supplierId) return;

    try {
      await this.supplierService.findOne(supplierId, restaurantId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          'O fornecedor informado não existe neste restaurante.',
        );
      }
      throw error;
    }
  }
}
