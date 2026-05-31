import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: {
      headers: Record<string, string | string[] | undefined>;
      authorization?: string;
    },
    payload: {
      sub: string;
      username?: string;
      globalRoles?: string[];
      restaurantId?: string;
      role?: string;
    },
  ) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Check blacklist
    const authHeader = req.headers.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.substring(7);
      const isBlacklisted = await this.redisService.isBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated (logout)');
      }
    }

    // Headers injetados pelo proxy (confiáveis pois vêm após validação no gateway)
    const proxyTenantId = req.headers['x-tenant-id'] as string | undefined;
    const proxyRole = req.headers['x-user-role'] as string | undefined;

    // Valida se os headers do proxy são consistentes com o token
    const restaurantId = proxyTenantId || payload.restaurantId || null;
    const role = proxyRole || payload.role || null;

    return {
      id: payload.sub,
      username: payload.username || 'unknown',
      restaurantId,
      role,
      globalRoles: payload.globalRoles || [],
    };
  }
}
