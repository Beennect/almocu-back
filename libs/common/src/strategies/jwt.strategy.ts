import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Estratégia JWT simples — apenas verifica assinatura do token.
 * Usada por menu, stock e order para confirmar que o usuário está logado.
 * Não faz checagem de blacklist (isso é responsabilidade do auth-app).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'super-secret-key-123',
    });
  }

  async validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }
    // Retorna o payload decodificado como req.user nos controllers
    return {
      id: payload.sub,
      _id: payload.sub,
      username: payload.username,
      restaurantId: payload.restaurantId,
      role: payload.role,
      globalRoles: payload.globalRoles,
    };
  }
}
