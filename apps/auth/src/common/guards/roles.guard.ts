/**
 * Guard de cargos com suporte a hierarquia.
 * OWNER > MANAGER > KITCHEN/WAITER/DELIVERY/CASHIER > COMMON
 *
 * Re-exporta o RolesGuard unificado de @app/common.
 * Mantido aqui para compatibilidade com o módulo do auth-app.
 */
export { RolesGuard } from '@app/common';
