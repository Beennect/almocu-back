import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ModuleAcquisition,
  ModuleAcquisitionDocument,
} from './module-acquisition.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { UserRestaurant, UserRestaurantDocument } from '../users/user-restaurant.schema';
import { UserRole } from '@app/common';

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  acquired: boolean;
  acquiredAt?: Date;
}

const PREMIUM_MODULES: Omit<ModuleInfo, 'acquired' | 'acquiredAt'>[] = [
  {
    id: 'mesas',
    name: 'Mesas & Reservas',
    description: 'Mapa interativo de mesas, comandas e QR code na mesa.',
    price: 1490,
  },
  {
    id: 'financeiro',
    name: 'Financeiro Avançado',
    description: 'Fluxo de caixa avançado, demonstrativo de DRE automático.',
    price: 1990,
  },
  {
    id: 'fidelidade',
    name: 'Fidelidade & Cupons',
    description: 'Criação de cashbacks acumulativos e cupons inteligentes.',
    price: 1290,
  },
  {
    id: 'delivery',
    name: 'Delivery Próprio',
    description: 'Cardápio público próprio para vendas via link / WhatsApp.',
    price: 2490,
  },
];

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    @InjectModel(ModuleAcquisition.name)
    private acquisitionModel: Model<ModuleAcquisitionDocument>,
    @InjectModel(Restaurant.name)
    private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(UserRestaurant.name)
    private userRestaurantModel: Model<UserRestaurantDocument>,
  ) {}

  async getModules(restaurantId: string): Promise<ModuleInfo[]> {
    const acquisitions = await this.acquisitionModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .exec();

    const acquiredMap = new Map<string, Date>();
    for (const a of acquisitions) {
      acquiredMap.set(a.moduleId, a.acquiredAt);
    }

    return PREMIUM_MODULES.map((mod) => ({
      ...mod,
      acquired: acquiredMap.has(mod.id),
      acquiredAt: acquiredMap.get(mod.id),
    }));
  }

  async acquireModule(
    restaurantId: string,
    moduleId: string,
    userId: string,
    active: boolean = true,
  ): Promise<ModuleInfo> {
    const mod = PREMIUM_MODULES.find((m) => m.id === moduleId);
    if (!mod) {
      throw new NotFoundException(`Módulo "${moduleId}" não encontrado`);
    }

    // Verificar permissão (apenas OWNER)
    const link = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        role: UserRole.OWNER,
        status: 'active',
      })
      .exec();

    if (!link) {
      throw new ForbiddenException(
        'Apenas o proprietário pode gerenciar módulos do restaurante',
      );
    }

    if (active) {
      // Ativar módulo
      try {
        await this.acquisitionModel.create({
          restaurantId: new Types.ObjectId(restaurantId),
          moduleId,
          acquiredAt: new Date(),
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw new ConflictException(`Módulo "${moduleId}" já está ativo`);
        }
        throw err;
      }

      // Side effects específicos por módulo
      if (moduleId === 'mesas') {
        await this.restaurantModel
          .findOneAndUpdate(
            { _id: new Types.ObjectId(restaurantId) },
            { $set: { 'features.hasTables': true } },
          )
          .exec();
      }

      this.logger.log(`Módulo "${moduleId}" ativado para restaurante ${restaurantId}`);
    } else {
      // Desativar módulo
      const result = await this.acquisitionModel
        .deleteOne({
          restaurantId: new Types.ObjectId(restaurantId),
          moduleId,
        })
        .exec();

      if (result.deletedCount === 0) {
        throw new NotFoundException(`Módulo "${moduleId}" não está ativo`);
      }

      // Side effects específicos por módulo
      if (moduleId === 'mesas') {
        await this.restaurantModel
          .findOneAndUpdate(
            { _id: new Types.ObjectId(restaurantId) },
            { $set: { 'features.hasTables': false } },
          )
          .exec();
      }

      this.logger.log(`Módulo "${moduleId}" desativado para restaurante ${restaurantId}`);
    }

    return this.getModules(restaurantId).then((modules) =>
      modules.find((m) => m.id === moduleId)!,
    );
  }
}
