import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { UserRestaurant, UserRestaurantDocument } from '../users/schemas/user-restaurant.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
    @InjectModel(UserRestaurant.name)
    private userRestaurantModel: Model<UserRestaurantDocument>,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);
    
    if (user && await bcrypt.compare(pass, user.password)) {
      const userObj = user.toObject();
      return userObj;
    }
    return null;
  }

  async login(user: any) {
    // Buscar todos os restaurantes vinculados ao usuário
    const userLinks = await this.userRestaurantModel
      .find({ userId: new Types.ObjectId(user.id), status: 'active' })
      .exec();

    let restaurantId: string | null = null;
    let role: string | null = null;

    // Se tiver apenas 1 restaurante, já seleciona automaticamente
    if (userLinks.length === 1) {
      restaurantId = userLinks[0].restaurantId.toString();
      role = userLinks[0].role;
    }

    const payload = { 
      username: user.username, 
      sub: user.id, 
      _id: user.id,
      globalRoles: user.globalRoles,
      restaurantId: restaurantId,
      role: role
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        globalRoles: user.globalRoles,
        restaurants: userLinks.map(link => ({
          restaurantId: link.restaurantId,
          role: link.role
        })),
        activeRestaurantId: restaurantId,
        activeRole: role,
        needsRestaurantSelection: userLinks.length > 1 && !restaurantId,
      }
    };
  }

  async switchTenant(user: any, targetRestaurantId: string) {
    try {
      console.log('Iniciando switch-tenant para restaurante:', targetRestaurantId);
      console.log('Usuário atual no request:', user);

      // Validar se o vínculo existe e está ativo
      const link = await this.userRestaurantModel.findOne({
        userId: new Types.ObjectId(user.id || user.sub),
        restaurantId: new Types.ObjectId(targetRestaurantId),
        status: 'active'
      }).exec();

      if (!link) {
        console.warn('Vínculo não encontrado para User:', user.id, 'e Restaurant:', targetRestaurantId);
        throw new UnauthorizedException('Você não tem acesso a este restaurante');
      }

      const payload = { 
        username: user.username, 
        sub: user.id || user.sub, 
        _id: user.id || user.sub,
        globalRoles: user.globalRoles || ['user'],
        restaurantId: targetRestaurantId,
        role: link.role
      };

      console.log('Novo payload gerado:', payload);

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: payload.sub,
          username: payload.username,
          activeRestaurantId: targetRestaurantId,
          activeRole: link.role
        }
      };
    } catch (error) {
      console.error('ERRO NO SWITCH TENANT:', error);
      throw error;
    }
  }

  async logout(token: string) {
    try {
      const decoded: any = this.jwtService.decode(token);
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await this.redisService.addToBlacklist(token, expiresIn);
        }
      }
    } catch (e) {
      // Ignorar erros
    }
  }
}
