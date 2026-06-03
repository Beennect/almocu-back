import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import {
  UserRestaurant,
  UserRestaurantDocument,
} from '../users/user-restaurant.schema';
import { UserRole } from '@app/common';
import { RegisterDto } from './dto/register.dto';

interface JwtPayload {
  username: string;
  sub: string;
  _id: string;
  globalRoles: string[];
  restaurantId: string | null;
  role: UserRole | null;
}

interface RestaurantLink {
  restaurantId: {
    _id: Types.ObjectId;
    name: string;
    status: string;
  };
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    @InjectModel(UserRestaurant.name)
    private readonly userRestaurantModel: Model<UserRestaurantDocument>,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);

    if (
      !user ||
      !user.password ||
      !(await bcrypt.compare(pass, user.password))
    ) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Sua conta está desativada');
    }

    return user.toObject();
  }

  async register(registerDto: RegisterDto) {
    const { username, password, email, name } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
      email,
      name,
      globalRoles: ['user'],
    });

    // password já é removido pelo transform do toJSON no schema
    return user.toJSON();
  }

  async login(user: any) {
    const userLinks = (await this.userRestaurantModel
      .find({ userId: new Types.ObjectId(user.id), status: 'active' })
      .populate('restaurantId')
      .exec()) as unknown as RestaurantLink[];

    const payload = this.buildPayload({
      username: user.username,
      sub: user.id,
      globalRoles: user.globalRoles,
      restaurantId: null,
      role: null,
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        globalRoles: user.globalRoles,
        restaurants: userLinks
          .filter((link) => link.restaurantId)
          .map((link) => ({
            id: link.restaurantId._id,
            name: link.restaurantId.name,
            role: link.role,
            status: link.restaurantId.status,
          })),
      },
    };
  }

  async validateUserRestaurantAccess(userId: string, restaurantId: string) {
    const link = (await this.userRestaurantModel
      .findOne({
        userId: new Types.ObjectId(userId),
        restaurantId: new Types.ObjectId(restaurantId),
        status: 'active',
      })
      .populate('restaurantId')
      .exec()) as unknown as RestaurantLink | null;

    if (!link?.restaurantId) {
      throw new UnauthorizedException('Você não tem acesso a este restaurante');
    }
    if (link.restaurantId.status !== 'active') {
      throw new UnauthorizedException(
        'Este restaurante está inativo ou suspenso',
      );
    }

    return link;
  }

  async validateOAuthUser(profile: {
    googleId: string;
    email: string;
    name: string;
    username?: string;
  }) {
    let user = await this.usersService.findOneByGoogleId(profile.googleId);

    if (!user) {
      user = await this.usersService.findOneByEmail(profile.email);

      if (user) {
        // Vincula conta existente ao Google
        user = await this.usersService.update(user.id, {
          googleId: profile.googleId,
        });
      } else {
        // Cria novo usuário
        user = await this.usersService.create({
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          username: profile.username || profile.email.split('@')[0],
          isActive: true,
          globalRoles: ['user'],
        });
      }
    }

    if (!user?.isActive) {
      throw new UnauthorizedException('Sua conta está desativada');
    }

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const fullUser = await this.usersService.findOneByUsername(user.username);
    if (
      !fullUser?.password ||
      !(await bcrypt.compare(currentPassword, fullUser.password))
    ) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { password: hashedPassword });
  }

  async logout(token: string) {
    try {
      const decoded = this.jwtService.decode(token);
      if (decoded?.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await this.redisService.addToBlacklist(token, expiresIn);
        }
      }
    } catch (error) {
      this.logger.warn(
        'Failed to blacklist token during logout',
        (error as Error).message,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private buildPayload(args: {
    username: string;
    sub: string;
    globalRoles: string[];
    restaurantId: string | null;
    role: UserRole | null;
  }): JwtPayload {
    return {
      username: args.username,
      sub: args.sub,
      _id: args.sub,
      globalRoles: args.globalRoles,
      restaurantId: args.restaurantId,
      role: args.role,
    };
  }
}
