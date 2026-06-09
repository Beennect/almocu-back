import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Pageable } from '@app/common';
import {
  Restaurant,
  RestaurantDocument,
  Plan,
  PLAN_LIMITS,
} from './restaurant.schema';
import {
  UserRestaurant,
  UserRestaurantDocument,
} from '../users/user-restaurant.schema';
import { UserRole, getRoleRank } from '@app/common';
import { RedisService } from '../redis/redis.service';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  getTotpWindow,
  secondsUntilNextWindow,
} from './totp.util';


@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

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
    plan: Plan = Plan.BASIC,
  ): Promise<RestaurantDocument> {
    const existingByName = await this.restaurantModel.findOne({ name }).exec();
    if (existingByName) {
      throw new ConflictException(
        `Já existe um restaurante com esse nome".`,
      );
    }

    const existingByCnpj = await this.restaurantModel.findOne({ cnpj }).exec();
    if (existingByCnpj) {
      throw new ConflictException(
        `Já existe um restaurante com esse CNPJ.`,
      );
    }

    const upperPlan = (plan ?? Plan.BASIC).toUpperCase() as Plan;
    const maxBranches = PLAN_LIMITS[upperPlan];
    if (maxBranches === undefined) {
      throw new BadRequestException(
        `Plano inválido: "${plan}". Use BASIC, PROFESSIONAL, NETWORK ou PREMIUM.`,
      );
    }

    const totpSecret = generateTotpSecret();

    const restaurant = new this.restaurantModel({
      name,
      cnpj,
      totpSecret,
      plan: upperPlan,
      maxBranches,
    });
    const savedRestaurant = await restaurant.save();

    // Vincular o criador como OWNER
    await this.userRestaurantModel.create({
      userId: new Types.ObjectId(ownerId),
      restaurantId: savedRestaurant._id,
      role: UserRole.OWNER,
      status: 'active',
    });

    this.publishEvent(savedRestaurant._id.toString(), 'staff:changed', {
      action: 'create',
      userId: ownerId,
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

    // ⚡ Verificação atômica de limite via findOneAndUpdate + $inc
    // Evita TOCTOU: countDocuments (check) + save (act) agora são atômicos.
    const parentWithSlot = await this.restaurantModel
      .findOneAndUpdate(
        {
          _id: parent._id,
          $expr: { $lt: ['$branchCount', '$maxBranches'] },
        },
        { $inc: { branchCount: 1 } },
        { new: true },
      )
      .exec();

    if (!parentWithSlot) {
      // Pode ser que o restaurante tenha sido excluído ou o limite foi atingido
      const stillExists = await this.restaurantModel.exists({ _id: parent._id });
      if (!stillExists) {
        throw new NotFoundException('Restaurante principal não encontrado');
      }
      throw new ConflictException(
        `Limite de filiais atingido para o plano ${parent.plan}`,
      );
    }

    // Verificar duplicidade de nome (ainda há pequena janela TOCTOU — mitigada
    // pelo índice único composto abaixo e captura de erro E11000)
    const branchExists = await this.restaurantModel
      .findOne({ name, parentId: parent._id })
      .exec();
    if (branchExists) {
      // Devolver o slot reservado
      await this.restaurantModel
        .updateOne(
          { _id: parent._id, branchCount: { $gt: 0 } },
          { $inc: { branchCount: -1 } },
        )
        .exec();
      throw new ConflictException(
        `Já existe uma filial com esse nome neste restaurante.`,
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

    let savedBranch: RestaurantDocument;
    try {
      savedBranch = await branch.save();
    } catch (err: any) {
      // Devolver o slot reservado se o save falhar
      await this.restaurantModel
        .updateOne(
          { _id: parent._id, branchCount: { $gt: 0 } },
          { $inc: { branchCount: -1 } },
        )
        .exec();

      // Se for erro de duplicidade (E11000), relançar como Conflict
      if (err?.code === 11000) {
        throw new ConflictException(
          `Já existe uma filial com esse nome neste restaurante.`,
        );
      }
      throw err;
    }

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
   *
   * Também armazena um cache em Redis (TTL = 7500s) para que
   * `joinWithInviteCode()` possa fazer lookup O(1) sem escanear
   * todos os restaurantes.
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

    // Cachear o código em Redis para lookup O(1) no join
    // TTL = 7500s cobre 2 janelas (7200s) + margem de segurança
    const window = getTotpWindow();
    const cacheKey = `totp:code:${code}:window:${window}`;
    await this.redisService.set(cacheKey, restaurantId, 7500);

    return { code, expiresInSeconds };
  }

  /**
   * Entrada via código TOTP com verificação de unicidade por janela.
   *
   * Fluxo:
   *  1. Tenta lookup O(1) via Redis cache (populado por getCurrentInviteCode()).
   *  2. Se não encontrar no cache, faz streaming cursor sobre restaurantes
   *     (evita carregar todos os totpSecret em memória).
   *  3. Garante via Redis que o código não foi usado por outro restaurante
   *     no mesmo período (anti-colisão e anti-replay).
   *  4. Vincula o usuário ao restaurante encontrado.
   */
  async joinWithInviteCode(
    inviteCode: string,
    userId: string,
  ): Promise<UserRestaurantDocument> {
    const normalizedCode = inviteCode.toUpperCase();

    // ── 1. Tentativa rápida via Redis cache (O(1)) ──
    let matchedRestaurant: RestaurantDocument | null = null;
    let matchedWindow: number | null = null;

    // Verificar janela atual e anterior
    for (const windowOffset of [0, -1]) {
      const window = getTotpWindow(windowOffset);
      const cacheKey = `totp:code:${normalizedCode}:window:${window}`;
      const cachedRestaurantId = await this.redisService.get(cacheKey);

      if (cachedRestaurantId) {
        // Cache hit — buscar documento diretamente
        const restaurant = await this.restaurantModel
          .findById(cachedRestaurantId)
          .select('+totpSecret')
          .exec();

        if (restaurant) {
          // Verificar se o código realmente corresponde (validação dupla)
          const validWindow = verifyTotpCode(normalizedCode, restaurant.totpSecret);
          if (validWindow !== null) {
            matchedRestaurant = restaurant;
            matchedWindow = validWindow;
            break;
          }
        }
      }
    }

    // ── 2. Fallback: streaming cursor (memória O(1) em vez de O(N)) ──
    if (!matchedRestaurant) {
      const cursor = this.restaurantModel
        .find()
        .select('+totpSecret')
        .cursor();

      for await (const restaurant of cursor) {
        const window = verifyTotpCode(normalizedCode, restaurant.totpSecret);
        if (window !== null) {
          matchedRestaurant = restaurant;
          matchedWindow = window;
          break;
        }
      }
    }

    if (!matchedRestaurant || matchedWindow === null) {
      throw new UnauthorizedException('Código de convite inválido ou expirado');
    }

    // ── 3. Anti-colisão: mesmo código na mesma janela não pode ser
    //       reivindicado por dois restaurantes diferentes ──
    const antiCollisionKey = `totp:window:${matchedWindow}:code:${normalizedCode}`;
    const existingRestaurantId = await this.redisService.get(antiCollisionKey);

    if (
      existingRestaurantId &&
      existingRestaurantId !== matchedRestaurant._id.toString()
    ) {
      throw new ConflictException(
        'Código de convite em conflito com outro restaurante neste momento. Aguarde o próximo código.',
      );
    }

    if (!existingRestaurantId) {
      await this.redisService.set(
        antiCollisionKey,
        matchedRestaurant._id.toString(),
        7500,
      );
    }

    // ── 4. Verificar vínculo duplicado ──
    const existing = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: matchedRestaurant._id,
      })
      .exec();

    if (existing) {
      throw new ConflictException('Você já faz parte deste restaurante');
    }

    const created = await this.userRestaurantModel.create({
      userId: new Types.ObjectId(userId),
      restaurantId: matchedRestaurant._id,
      role: UserRole.COMMON,
      status: 'active',
    });

    this.publishEvent(matchedRestaurant._id.toString(), 'staff:changed', {
      action: 'join',
      userId,
    });

    return created;
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

    // Exclui OWNER da listagem — ele não é "apenas gerente", sim proprietário
    return this.userRestaurantModel
      .find({
        restaurantId: new Types.ObjectId(restaurantId),
        role: { $ne: UserRole.OWNER },
      })
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

    const requesterRank = getRoleRank(requester.role);
    const targetRank = getRoleRank(link.role);
    const newRoleRank = getRoleRank(newRole);

    // MANAGER não pode alterar cargo de OWNER ou outro MANAGER
    if (targetRank >= requesterRank && requester.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar o cargo deste usuário',
      );
    }

    // Ninguém pode alterar o próprio cargo
    if (targetUserId === userId) {
      throw new BadRequestException('Você não pode alterar seu próprio cargo');
    }

    // MANAGER não pode promover ninguém a OWNER ou MANAGER
    if (requester.role === UserRole.MANAGER && newRoleRank >= requesterRank) {
      throw new ForbiddenException(
        'Gerentes não podem promover para gerente ou proprietário',
      );
    }

    link.role = newRole;
    const saved = await link.save();

    this.publishEvent(restaurantId, 'staff:changed', {
      action: 'roleUpdate',
      userId: targetUserId,
      newRole,
    });

    return saved;
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

    // Busca o vínculo do alvo para validar hierarquia
    const targetLink = await this.userRestaurantModel
      .findOne({
        restaurantId: new Types.ObjectId(restaurantId),
        userId: new Types.ObjectId(targetUserId),
      })
      .exec();

    if (!targetLink) {
      throw new NotFoundException('Vínculo de funcionário não encontrado');
    }

    // MANAGER não pode remover OWNER nem outro MANAGER
    if (requester.role === UserRole.MANAGER) {
      const targetRank = getRoleRank(targetLink.role);
      const managerRank = getRoleRank(UserRole.MANAGER);
      if (targetRank >= managerRank) {
        throw new ForbiddenException(
          'Gerentes não podem remover outros gerentes ou o proprietário',
        );
      }
    }

    await this.userRestaurantModel
      .deleteOne({
        restaurantId: new Types.ObjectId(restaurantId),
        userId: new Types.ObjectId(targetUserId),
      })
      .exec();

    this.publishEvent(restaurantId, 'staff:changed', {
      action: 'remove',
      userId: targetUserId,
    });
  }

  async findUserRestaurants(userId: string): Promise<any[]> {
    // Retorna todos os vínculos do usuário (inclusive de restaurantes suspensos/inativos),
    // para que o frontend possa exibir restaurantes suspensos e permitir reativação.
    return this.userRestaurantModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('restaurantId')
      .exec();
  }

  /**
   * Suspende (soft delete) um restaurante e seus vínculos.
   * Se for matriz, suspende também todas as filiais.
   */
  async suspend(
    restaurantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const restaurant = await this.restaurantModel.findById(restaurantId).exec();
    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    // Apenas OWNER pode suspender
    const link = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: restaurant._id,
        role: UserRole.OWNER,
        status: 'active',
      })
      .exec();

    if (!link) {
      throw new ForbiddenException(
        'Apenas o proprietário pode suspender o restaurante',
      );
    }

    // IDs para suspender: este restaurante + filiais (se for matriz)
    const idsToSuspend: Types.ObjectId[] = [restaurant._id as Types.ObjectId];

    if (!restaurant.parentId) {
      // É matriz — busca filiais
      const branches = await this.restaurantModel
        .find({ parentId: restaurant._id })
        .exec();
      idsToSuspend.push(...branches.map((b) => b._id as Types.ObjectId));
    }

    this.logger.debug(
      `Suspend: idsToSuspend = ${idsToSuspend.map((id) => id.toString()).join(', ')}`,
    );

    // ⚡ Suspende restaurantes em lote único (updateMany)
    // Antes: N queries individuais (findOneAndUpdate). Agora: 1 query.
    const suspendResult = await this.restaurantModel
      .updateMany(
        { _id: { $in: idsToSuspend } },
        { $set: { status: 'suspended' } },
      )
      .exec();

    if (suspendResult.matchedCount !== idsToSuspend.length) {
      this.logger.warn(
        `Suspend: esperava ${idsToSuspend.length} restaurante(s), encontrou ${suspendResult.matchedCount}`,
      );
    }

    // Se for matriz, decrementar branchCount do pai (as filiais não têm pai próprio)
    // As filiais ao serem suspensas liberam slots no plano
    if (!restaurant.parentId && idsToSuspend.length > 1) {
      await this.restaurantModel
        .updateOne(
          { _id: restaurant._id, branchCount: { $gt: 0 } },
          { $inc: { branchCount: -(idsToSuspend.length - 1) } },
        )
        .exec();
    }

    // Desativa vínculos de usuários
    const userLinkResult = await this.userRestaurantModel
      .updateMany(
        { restaurantId: { $in: idsToSuspend } },
        { $set: { status: 'inactive' } },
      )
      .exec();

    this.logger.debug(
      `Suspend: ${userLinkResult.modifiedCount} vínculos de usuários desativados`,
    );

    this.logger.warn(
      `Restaurante ${restaurant.name} (${restaurantId}) suspenso por usuário ${userId}. ${idsToSuspend.length - 1} filial(is) também suspensa(s).`,
    );

    return {
      message:
        idsToSuspend.length > 1
          ? `Restaurante e ${idsToSuspend.length - 1} filial(is) suspensos com sucesso`
          : 'Restaurante suspenso com sucesso',
    };
  }

  /**
   * Reativa um restaurante suspenso.
   * Regenera a chave TOTP por segurança.
   */
  async reactivate(
    restaurantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const restaurant = await this.restaurantModel.findById(restaurantId).exec();
    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    if (restaurant.status !== 'suspended') {
      throw new BadRequestException(
        'Apenas restaurantes suspensos podem ser reativados',
      );
    }

    // Apenas OWNER pode reativar
    const link = await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: restaurant._id,
        role: UserRole.OWNER,
      })
      .exec();

    if (!link) {
      throw new ForbiddenException(
        'Apenas o proprietário pode reativar o restaurante',
      );
    }

    // IDs para reativar: este + filiais (se for matriz)
    const idsToReactivate: Types.ObjectId[] = [
      restaurant._id as Types.ObjectId,
    ];

    if (!restaurant.parentId) {
      const branches = await this.restaurantModel
        .find({ parentId: restaurant._id })
        .exec();
      idsToReactivate.push(...branches.map((b) => b._id as Types.ObjectId));
    }

    // ⚡ Reativa restaurantes em lote (bulkWrite)
    // Cada restaurante precisa de um totpSecret único, por isso não usamos
    // updateMany. bulkWrite envia todas as operações em 1 única chamada.
    const reactivateOps = idsToReactivate.map((id) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            status: 'active',
            totpSecret: generateTotpSecret(),
          },
        },
      },
    }));

    const bulkResult = await this.restaurantModel.bulkWrite(reactivateOps, {
      ordered: false,
    });

    if (bulkResult.hasWriteErrors()) {
      const writeErrors = bulkResult.getWriteErrors();
      this.logger.error(
        `Reactivate: ${writeErrors.length} falha(s)`,
        writeErrors,
      );
      throw new InternalServerErrorException(
        `Falha ao reativar ${writeErrors.length} filial(is). Tente novamente.`,
      );
    }

    // Reativa vínculos de usuários
    const userLinkResult = await this.userRestaurantModel
      .updateMany(
        { restaurantId: { $in: idsToReactivate } },
        { $set: { status: 'active' } },
      )
      .exec();

    this.logger.debug(
      `Reactivate: ${userLinkResult.modifiedCount} vínculos de usuários reativados`,
    );

    this.logger.log(
      `Restaurante ${restaurant.name} (${restaurantId}) reativado por usuário ${userId}.`,
    );

    return { message: 'Restaurante reativado com sucesso' };
  }

  private async publishEvent(
    restaurantId: string,
    type: string,
    payload: any,
  ): Promise<void> {
    try {
      await this.redisService.publish(
        `realtime:${restaurantId}`,
        JSON.stringify({ type, payload }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish realtime event ${type}: ${(err as Error).message}`,
      );
    }
  }
}
