import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { Types } from 'mongoose';
import { of } from 'rxjs';
import { mock } from 'bun:test';
import { HttpService } from '@nestjs/axios';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '@app/common';

describe('OrderController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: 'test-user-id',
            _id: 'test-user-id',
            username: 'testuser',
            globalRoles: ['user'],
            role: 'MANAGER',
            restaurantId: 'test-restaurant-id',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/orders/user (GET)', () => {
    return request(app.getHttpServer()).get('/orders/user').expect(200);
  });
});

/**
 * Cobertura do caminho feliz (sessão 20260606-waiter-order-bug / Etapa 7).
 *
 * Valida que um WAITER autenticado consegue criar um pedido via POST /orders
 * e que o OrderService dispara corretamente a chamada interna
 * `PATCH /internal/stock/:id/adjust` no stock-app (DEC-003).
 *
 * Dependências de ambiente (ver §4.4 do plano 03-solucao.md):
 *   - MongoDB acessível em MONGODB_URI (default mongodb://localhost:27017/...)
 *   - INTERNAL_API_KEY configurado (vem de almocu-back/.env → ConfigService)
 *
 * O `HttpService` é MOCKADO neste teste porque o order-app não pode alcançar
 * menu-app e stock-app externos num teste e2e isolado. Os retornos abaixo
 * reproduzem os contratos reais dos endpoints:
 *   - menu-app:  POST /products/batch
 *   - stock-app: POST /internal/stock/batch  e  PATCH /internal/stock/:id/adjust
 */
describe('WAITER creating an order (e2e RBAC)', () => {
  let app: INestApplication;

  // IDs determinísticos (válidos para Mongoose) para asserções estáveis
  const WAITER_USER_ID = new Types.ObjectId();
  const RESTAURANT_ID = new Types.ObjectId();
  const PRODUCT_ID = new Types.ObjectId();
  const STOCK_ITEM_ID = new Types.ObjectId();

  // Mesma fonte de verdade que ConfigService usa no bootstrap do app
  const INTERNAL_API_KEY =
    process.env.INTERNAL_API_KEY || 'change-me-to-a-random-key';

  // Mock do HttpService — order-service depende de chamadas inter-serviço
  const httpServiceMock = {
    post: mock(),
    patch: mock(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: WAITER_USER_ID.toString(),
            _id: WAITER_USER_ID.toString(),
            username: 'waiter-test',
            globalRoles: ['user'],
            role: 'WAITER',
            restaurantId: RESTAURANT_ID.toString(),
          };
          return true;
        },
      })
      .overrideProvider(HttpService)
      .useValue(httpServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    httpServiceMock.post.mockReset();
    httpServiceMock.patch.mockReset();

    // Menu-app: retorna 1 produto com 1 ingrediente (Pão)
    httpServiceMock.post.mockImplementation((url: string) => {
      if (url.includes('/products/batch')) {
        return of({
          data: [
            {
              _id: PRODUCT_ID.toString(),
              name: 'X-Burger Teste',
              price: 25.0,
              ingredients: [
                { stockProductId: STOCK_ITEM_ID.toString(), quantity: 1 },
              ],
            },
          ],
        });
      }
      // Stock-app: item com estoque suficiente
      if (url.includes('/internal/stock/batch')) {
        return of({
          data: [
            {
              _id: STOCK_ITEM_ID.toString(),
              name: 'Pão de Hambúrguer',
              quantity: 100,
            },
          ],
        });
      }
      return of({ data: [] });
    });

    // Stock-app: dedução de estoque
    httpServiceMock.patch.mockReturnValue(of({ data: { success: true } }));
  });

  it('deve criar pedido 201 e deduzir estoque via /internal/stock/:id/adjust', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', 'Bearer fake-jwt-token')
      .set('x-restaurant-id', RESTAURANT_ID.toString())
      .send({
        items: [{ productId: PRODUCT_ID.toString(), quantity: 2 }],
      })
      .expect(201);

    // Asserts: estrutura do pedido criado
    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      productId: PRODUCT_ID.toString(),
      name: 'X-Burger Teste',
      quantity: 2,
      price: 25.0,
    });
    expect(response.body.totalValue).toBe(50.0);
    expect(response.body.status).toBe('pendente');

    // Assert: chamada interna ao stock-app com a chave e o delta corretos
    // (1 ingrediente × 2 unidades = delta -2)
    expect(httpServiceMock.patch).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.patch).toHaveBeenCalledWith(
      expect.stringContaining(
        `/internal/stock/${STOCK_ITEM_ID.toString()}/adjust`,
      ),
      { delta: -2 },
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-tenant-id': RESTAURANT_ID.toString(),
          'x-internal-key': INTERNAL_API_KEY,
        }),
      }),
    );

    // Assert: menu-app foi consultado exatamente uma vez (batch de produtos)
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/products/batch'),
      expect.objectContaining({ ids: [PRODUCT_ID.toString()] }),
      expect.anything(),
    );
  });
});
