import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Pageable } from '@app/common';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import {
  UserRestaurant,
  UserRestaurantDocument,
  UserRole,
} from '../users/user-restaurant.schema';
import { RedisService } from '../redis/redis.service';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  secondsUntilNextWindow,
} from './totp.util';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name)
    private restaurantModel: Model<RestaurantDocument>,
    @InjectModel(UserRestaurant.name)
    private userRestaurantModel: Model<UserRestaurantDocument>,
    private readonly redisService: RedisService,
  ) {}

  async create(
    name: string,
    cnpj: string,
    ownerId: string,
    maxBranches: number = 1,
  ): Promise<RestaurantDocument> {
    const existing = await this.restaurantModel.findOne({ name }).exec();
    if (existing) {
      throw new ConflictException(
        `Já existe um restaurante com o nome "${name}".`,
      );
    }

    const totpSecret = generateTotpSecret();

    const restaurant = new this.restaurantModel({
      name,
      cnpj,
      totpSecret,
      plan: 'BASIC',
      maxBranches: maxBranches || 1,
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

  async createBranch(
    name: string,
    parentId: string,
    ownerId: string,
  ): Promise<RestaurantDocument> {
    const parent = await this.restaurantModel.findById(parentId).exec();
    if (!parent) {
      throw new NotFoundException('Restaurante principal não encontrado');
    }

    // Verificar se o usuário é OWNER do restaurante principal
    const ownerLink = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(ownerId),
        restaurantId: parent._id,
        role: UserRole.OWNER,
      })
      .exec();

    if (!ownerLink) {
      throw new ConflictException('Apenas o proprietário pode criar filiais');
    }

    // Verificar limite de filiais
    const branchCount = await this.restaurantModel
      .countDocuments({ parentId: parent._id })
      .exec();
    if (branchCount >= parent.maxBranches) {
      throw new ConflictException(
        `Limite de filiais atingido para o plano ${parent.plan}`,
      );
    }

    const branchExists = await this.restaurantModel
      .findOne({ name, parentId: parent._id })
      .exec();
    if (branchExists) {
      throw new ConflictException(
        `Já existe uma filial com o nome "${name}" neste restaurante.`,
      );
    }

    const totpSecret = generateTotpSecret();
    const branch = new this.restaurantModel({
      name,
      cnpj: parent.cnpj,
      totpSecret,
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

  /**
   * Retorna o código TOTP atual do restaurante e o tempo restante na janela.
   * Valida se o usuário tem permissão (OWNER/MANAGER) no restaurante.
   */
  async getCurrentInviteCode(
    restaurantId: string,
    userId: string,
  ): Promise<{ code: string; expiresInSeconds: number }> {
    const restaurant = await this.restaurantModel
      .findById(restaurantId)
      .select('+totpSecret')
      .exec();
    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    const link = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        status: 'active',
        role: { $in: [UserRole.OWNER, UserRole.MANAGER] },
      })
      .exec();

    if (!link) {
      throw new ForbiddenException(
        'Apenas proprietários e gerentes podem acessar o código de convite',
      );
    }

    const code = generateTotpCode(restaurant.totpSecret);
    const expiresInSeconds = secondsUntilNextWindow();

    return { code, expiresInSeconds };
  }

  /**
   * Entrada via código TOTP com verificação de unicidade por janela.
   *
   * Fluxo:
   *  1. Busca todos os restaurantes e verifica qual deles gera o código informado
   *     (janela atual ou anterior — tolerância de 2 horas).
   *  2. Garante via Redis que o código não foi usado por outro restaurante
   *     no mesmo período (anti-colisão e anti-replay).
   *  3. Vincula o usuário ao restaurante encontrado.
   */
  async joinWithInviteCode(
    inviteCode: string,
    userId: string,
  ): Promise<UserRestaurantDocument> {
    const restaurants = await this.restaurantModel
      .find()
      .select('+totpSecret')
      .exec();

    let matchedRestaurant: RestaurantDocument | null = null;
    let matchedWindow: number | null = null;

    for (const restaurant of restaurants) {
      const window = verifyTotpCode(inviteCode, restaurant.totpSecret);
      if (window !== null) {
        matchedRestaurant = restaurant;
        matchedWindow = window;
        break;
      }
    }

    if (!matchedRestaurant || matchedWindow === null) {
      throw new UnauthorizedException('Código de convite inválido ou expirado');
    }

    // Chave Redis para garantir unicidade: mesmo código na mesma janela
    // não pode ser associado a mais de um restaurante simultaneamente.
    const redisKey = `totp:window:${matchedWindow}:code:${inviteCode}`;
    const existingRestaurantId = await this.redisService.get(redisKey);

    if (
      existingRestaurantId &&
      existingRestaurantId !== matchedRestaurant._id.toString()
    ) {
      // Colisão: outro restaurante reivindica este código nesta janela
      throw new ConflictException(
        'Código de convite em conflito com outro restaurante neste momento. Aguarde o próximo código.',
      );
    }

    // Registra o vínculo código→restaurante para a janela atual (TTL = 7500s)
    // cobre a janela atual (3600s) + janela anterior (3600s) + margem de segurança
    if (!existingRestaurantId) {
      await this.redisService.set(
        redisKey,
        matchedRestaurant._id.toString(),
        7500,
      );
    }

    // Verifica se já existe vínculo do usuário com este restaurante
    const existing = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: matchedRestaurant._id,
      })
      .exec();

    if (existing) {
      throw new ConflictException('Você já faz parte deste restaurante');
    }

    return this.userRestaurantModel.create({
      userId: new Types.ObjectId(userId),
      restaurantId: matchedRestaurant._id,
      role: UserRole.COMMON,
      status: 'active',
    });
  }

  async listStaff(
    restaurantId: string,
    userId: string,
    pageable: Pageable,
  ): Promise<any[]> {
    const link = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        status: 'active',
        role: { $in: [UserRole.OWNER, UserRole.MANAGER] },
      })
      .exec();

    if (!link) {
      throw new ForbiddenException(
        'Apenas proprietários e gerentes podem gerenciar a equipe',
      );
    }

    return this.userRestaurantModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .skip(pageable.skip)
      .limit(pageable.limit)
      .populate('userId', 'name email username')
      .exec();
  }

  async updateStaffRole(
    restaurantId: string,
    targetUserId: string,
    newRole: UserRole,
    userId: string,
  ): Promise<UserRestaurantDocument> {
    const requester = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        status: 'active',
        role: { $in: [UserRole.OWNER, UserRole.MANAGER] },
      })
      .exec();

    if (!requester) {
      throw new ForbiddenException(
        'Apenas proprietários e gerentes podem alterar cargos',
      );
    }

    const link = await this.userRestaurantModel
      .findOne({
        restaurantId: new Types.ObjectId(restaurantId),
        userId: new Types.ObjectId(targetUserId),
      })
      .exec();

    if (!link) {
      throw new NotFoundException('Vínculo de funcionário não encontrado');
    }

    link.role = newRole;
    return link.save();
  }

  async removeStaff(
    restaurantId: string,
    targetUserId: string,
    userId: string,
  ): Promise<void> {
    const requester = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        status: 'active',
        role: { $in: [UserRole.OWNER, UserRole.MANAGER] },
      })
      .exec();

    if (!requester) {
      throw new ForbiddenException(
        'Apenas proprietários e gerentes podem remover funcionários',
      );
    }

    const result = await this.userRestaurantModel
      .deleteOne({
        restaurantId: new Types.ObjectId(restaurantId),
        userId: new Types.ObjectId(targetUserId),
      })
      .exec();

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
