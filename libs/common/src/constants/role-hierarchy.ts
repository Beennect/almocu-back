import { UserRole } from '../enums/user-role.enum';

/**
 * Hierarquia de cargos.
 * Quanto maior o rank, mais permissões o cargo possui.
 * Um cargo com rank superior ou igual ao mínimo exigido tem acesso.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]: 100,
  [UserRole.MANAGER]: 70,
  [UserRole.KITCHEN]: 40,
  [UserRole.WAITER]: 30,
  [UserRole.DELIVERY]: 30,
  [UserRole.CASHIER]: 30,
  [UserRole.COMMON]: 10,
};

/**
 * Retorna o rank de um cargo.
 * Retorna 0 para cargos inválidos/desconhecidos.
 */
export function getRoleRank(role: string): number {
  return ROLE_HIERARCHY[role as UserRole] ?? 0;
}
