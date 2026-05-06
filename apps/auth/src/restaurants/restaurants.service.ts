import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from './schemas/restaurant.schema';
import { UserRestaurant, UserRestaurantDocument, UserRole } from '../users/schemas/user-restaurant.schema';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name)
    private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(UserRestaurant.name)
    private userRestaurantModel: Model<UserRestaurantDocument>,
  ) {}

  async create(name: string, cnpj: string, ownerId: string, maxBranches: number = 1): Promise<RestaurantDocument> {
    // Gerar um código de convite único
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const restaurant = new this.restaurantModel({
      name,
      cnpj,
      inviteCode,
      plan: 'BASIC',
      maxBranches: maxBranches || 1, // Permite definir o limite na criação
    });
    const savedRestaurant = await restaurant.save();

    // Vincular o criador como OWNER
    await this.userRestaurantModel.create({
      userId: new Types.ObjectId(ownerId),
      restaurantId: savedRestaurant._id,
      role: UserRole.OWNER,
      status: 'active',
    });

    return savedRestaurant;
  }

  async createBranch(name: string, parentId: string, ownerId: string): Promise<RestaurantDocument> {
    const parent = await this.restaurantModel.findById(parentId).exec();
    if (!parent) {
      throw new NotFoundException('Restaurante principal não encontrado');
    }

    // Verificar se o usuário é OWNER do restaurante principal
    const ownerLink = await this.userRestaurantModel.findOne({
      userId: new Types.ObjectId(ownerId),
      restaurantId: parent._id,
      role: UserRole.OWNER,
    }).exec();

    if (!ownerLink) {
      throw new ConflictException('Apenas o proprietário pode criar filiais');
    }

    // Verificar limite de filiais
    const branchCount = await this.restaurantModel.countDocuments({ parentId: parent._id }).exec();
    if (branchCount >= parent.maxBranches) {
      throw new ConflictException(`Limite de filiais atingido para o plano ${parent.plan}`);
    }

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const branch = new this.restaurantModel({
      name,
      cnpj: parent.cnpj,
      inviteCode,
      parentId: parent._id,
      plan: parent.plan,
      maxBranches: parent.maxBranches,
    });
    const savedBranch = await branch.save();

    // Vincular o proprietário também à filial
    await this.userRestaurantModel.create({
      userId: new Types.ObjectId(ownerId),
      restaurantId: savedBranch._id,
      role: UserRole.OWNER,
      status: 'active',
    });

    return savedBranch;
  }

  async joinWithInviteCode(inviteCode: string, userId: string): Promise<UserRestaurantDocument> {
    const restaurant = await this.restaurantModel.findOne({ inviteCode }).exec();
    if (!restaurant) {
      throw new NotFoundException('Código de convite inválido');
    }

    // Verifica se já existe vínculo
    const existing = await this.userRestaurantModel.findOne({
      userId: new Types.ObjectId(userId),
      restaurantId: restaurant._id,
    }).exec();

    if (existing) {
      throw new ConflictException('Você já faz parte deste restaurante');
    }

    return this.userRestaurantModel.create({
      userId: new Types.ObjectId(userId),
      restaurantId: restaurant._id,
      role: UserRole.WAITER, // Papel padrão ao entrar via código
      status: 'active',
    });
  }

  async listStaff(restaurantId: string): Promise<any[]> {
    return this.userRestaurantModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .populate('userId', 'name email username')
      .exec();
  }

  async updateStaffRole(restaurantId: string, targetUserId: string, newRole: UserRole): Promise<UserRestaurantDocument> {
    const link = await this.userRestaurantModel.findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      userId: new Types.ObjectId(targetUserId),
    }).exec();

    if (!link) {
      throw new NotFoundException('Vínculo de funcionário não encontrado');
    }

    link.role = newRole;
    return link.save();
  }

  async removeStaff(restaurantId: string, targetUserId: string): Promise<void> {
    const result = await this.userRestaurantModel.deleteOne({
      restaurantId: new Types.ObjectId(restaurantId),
      userId: new Types.ObjectId(targetUserId),
    }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Vínculo de funcionário não encontrado');
    }
  }

  async findUserRestaurants(userId: string): Promise<any[]> {
    return this.userRestaurantModel
      .find({ userId: new Types.ObjectId(userId), status: 'active' })
      .populate('restaurantId')
      .exec();
  }
}
