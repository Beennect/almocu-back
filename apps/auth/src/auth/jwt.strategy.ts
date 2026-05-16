import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'super-secret-key-123',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isBlacklisted = await this.redisService.isBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token inválido ou expirado (logout)');
      }
    }

    let restaurantId = payload.restaurantId;
    let role = payload.role;

    // Lógica Dinâmica: Se for enviado um x-restaurant-id no header, validamos na hora
    const headerRestaurantId = req.headers['x-restaurant-id'] as string;

    if (headerRestaurantId && headerRestaurantId !== restaurantId) {
      const link = await this.authService.validateUserRestaurantAccess(
        payload.sub,
        headerRestaurantId,
      );
      restaurantId = headerRestaurantId;
      role = link.role;
    }

    if (!restaurantId && !payload.globalRoles?.includes('admin')) {
      // Opcional: avisar que não há contexto de restaurante, mas não travar aqui
      // Deixa o RolesGuard travar se a rota exigir.
    }

    return {
      id: payload.sub,
      _id: payload.sub,
      username: payload.username,
      globalRoles: payload.globalRoles,
      restaurantId: restaurantId,
      role: role,
    };
  }
}
