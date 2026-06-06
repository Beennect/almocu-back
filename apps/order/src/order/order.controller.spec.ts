import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { RolesGuard, ROLES_KEY } from '@app/common';

describe('OrderController - RBAC', () => {
  let controller: OrderController;
  let mockService: Partial<OrderService>;
  let guard: RolesGuard;

  // Helper para construir o contexto de execução com user.role
  const buildContext = (role: string, globalRoles: string[] = []) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'u1', role, globalRoles },
        headers: { authorization: 'Bearer t' },
      }),
    }),
    getHandler: () => controller.create,
    getClass: () => OrderController,
  });

  beforeEach(async () => {
    mockService = {
      create: mock(() => Promise.resolve({ id: '1' } as any)),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockService }, Reflector],
    }).compile();
    controller = module.get<OrderController>(OrderController);
    guard = new RolesGuard(module.get<Reflector>(Reflector));
  });

  describe('RolesGuard logic', () => {
    it('OWNER pode acessar qualquer endpoint (acesso amplo)', () => {
      const ctx = buildContext('OWNER');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'KITCHEN'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).not.toThrow();
    });

    it('MANAGER pode acessar qualquer endpoint (acesso amplo)', () => {
      const ctx = buildContext('MANAGER');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'KITCHEN'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).not.toThrow();
    });

    it('admin global pode acessar qualquer endpoint', () => {
      const ctx = buildContext('COMMON', ['admin']);
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'KITCHEN'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).not.toThrow();
    });

    it('WAITER pode acessar endpoint com @Roles("WAITER", "OWNER", "MANAGER")', () => {
      const ctx = buildContext('WAITER');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'OWNER', 'MANAGER'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).not.toThrow();
    });

    it('KITCHEN NÃO pode acessar endpoint com @Roles("WAITER", "OWNER", "MANAGER") (membership estrito)', () => {
      const ctx = buildContext('KITCHEN');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'OWNER', 'MANAGER'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    });

    it('CASHIER NÃO pode acessar endpoint com @Roles("WAITER", "OWNER", "MANAGER") (bug Math.min corrigido)', () => {
      const ctx = buildContext('CASHIER');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'OWNER', 'MANAGER'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    });

    it('DELIVERY NÃO pode acessar endpoint com @Roles("WAITER", "OWNER", "MANAGER") (bug Math.min corrigido)', () => {
      const ctx = buildContext('DELIVERY');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'OWNER', 'MANAGER'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    });

    it('COMMON NÃO pode acessar endpoint com @Roles("WAITER", "OWNER", "MANAGER")', () => {
      const ctx = buildContext('COMMON');
      Reflect.defineMetadata(
        ROLES_KEY,
        ['WAITER', 'OWNER', 'MANAGER'],
        ctx.getHandler(),
      );
      expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    });
  });

  describe('POST /orders - @Roles annotation', () => {
    it('controller.create tem @Roles("WAITER", "OWNER", "MANAGER") (KITCHEN removido)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.create);
      expect(roles).toEqual(['WAITER', 'OWNER', 'MANAGER']);
      expect(roles).not.toContain('KITCHEN');
    });
  });
});
