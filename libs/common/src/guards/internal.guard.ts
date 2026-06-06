import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Guard para endpoints internos (service-to-service).
 * Verifica se o header x-internal-key corresponde à chave configurada.
 * Usa timingSafeEqual para prevenir timing attacks.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-internal-key'] as string | undefined;
    const expected = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expected || !key || key.length !== expected.length) {
      throw new UnauthorizedException('Chave interna inválida');
    }

    const buf1 = Buffer.from(key);
    const buf2 = Buffer.from(expected);

    if (!timingSafeEqual(buf1, buf2)) {
      throw new UnauthorizedException('Chave interna inválida');
    }

    return true;
  }
}
