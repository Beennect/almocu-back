/**
 * Cargos / Roles do sistema Almocu.
 * A ordem abaixo define a hierarquia de permissões:
 * OWNER > MANAGER > KITCHEN/WAITER/DELIVERY/CASHIER > COMMON
 */
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  KITCHEN = 'KITCHEN',
  WAITER = 'WAITER',
  DELIVERY = 'DELIVERY',
  CASHIER = 'CASHIER',
  COMMON = 'COMMON',
}
