import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/** Roles que têm acesso hierárquico (acessam tudo que roles inferiores acessam) */
const ADMIN_ROLES = new Set([UserRole.OWNER, UserRole.MANAGER]);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Admin global roles bypass (OWNER total)
    if (user.globalRoles?.includes('admin')) {
      return true;
    }

    if (!user.role) {
      throw new ForbiddenException(
        'Usuário não possui cargo definido para este restaurante',
      );
    }

    // OWNER e MANAGER têm acesso hierárquico a qualquer endpoint
    if (ADMIN_ROLES.has(user.role as UserRole)) {
      return true;
    }

    // Para demais roles: verificação EXATA de role na lista de permitidas
    if (!requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException(
        `Acesso negado: necessário cargo ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
