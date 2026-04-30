import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);
    
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    let restaurantId = null;

    // Se tiver apenas 1 restaurante permitido (Funcionário comum), já seta no JWT
    if (user.allowedRestaurants && user.allowedRestaurants.length === 1) {
      restaurantId = user.allowedRestaurants[0];
    }

    const payload = { 
      username: user.username, 
      _id: user.id, // Usando _id para compatibilidade com o que o Stock espera
      sub: user.id, 
      roles: user.roles,
      restaurantId: restaurantId 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        roles: user.roles,
        allowedRestaurants: user.allowedRestaurants || [],
        restaurantId: payload.restaurantId,
        needsBranchSelection: user.allowedRestaurants && user.allowedRestaurants.length > 1,
      }
    };
  }

  async switchTenant(user: any, targetRestaurantId: string) {
    // 1. Puxa os dados atualizados do banco para validar segurança
    const dbUser = await this.usersService.findById(user.id || user._id);
    if (!dbUser) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // 2. Verifica se o usuário tem permissão para esta filial
    // Se for ADMIN, permitimos (ou podemos checar a lista se o ADMIN tiver lista restrita)
    const isAdmin = dbUser.roles && dbUser.roles.includes('ADMIN');
    const isAllowed = dbUser.allowedRestaurants && dbUser.allowedRestaurants.includes(targetRestaurantId);

    if (!isAdmin && !isAllowed) {
      throw new UnauthorizedException('Você não tem acesso a esta filial');
    }

    // 3. Gera um novo payload com o restaurantId definitivo
    const payload = { 
      username: dbUser.username, 
      _id: dbUser.id, 
      sub: dbUser.id, 
      roles: dbUser.roles,
      restaurantId: targetRestaurantId 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        name: dbUser.name,
        roles: dbUser.roles,
        restaurantId: payload.restaurantId,
      }
    };
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
      // Ignorar erros de decode
    }
  }
}
