import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Define os cargos que podem acessar um endpoint.
 * Ex: @Roles('OWNER', 'MANAGER')
 * A hierarquia de cargos é aplicada pelo RolesGuard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
