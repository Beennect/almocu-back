import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '@app/common';
import { Stock, StockDocument } from '../src/stock/stock.schema';

describe('StockController (e2e)', () => {
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

  it('/stock (GET)', () => {
    return request(app.getHttpServer()).get('/stock').expect(200);
  });
});

/**
 * Cobertura do novo endpoint interno (sessão 20260606-waiter-order-bug / Etapa 7).
 *
 * Valida o acesso e o bloqueio de `PATCH /internal/stock/:id/adjust` (DEC-003):
 *   - 200 quando `x-internal-key` é válido e `x-tenant-id` é informado
 *   - 401 quando `x-internal-key` está ausente (chave interna obrigatória)
 *
 * Dependências de ambiente:
 *   - MongoDB acessível em MONGODB_URI (default mongodb://localhost:27017/...)
 *   - INTERNAL_API_KEY configurado (vem de almocu-back/.env → ConfigService)
 *
 * Nota: este describe cria seu próprio TestingModule para ter acesso direto
 * ao `StockModel` (necessário para inserir e verificar itens no banco).
 */
describe('InternalStockController.adjustInternal (e2e)', () => {
  let app: INestApplication;
  let stockModel: Model<StockDocument>;
  const INTERNAL_API_KEY =
    process.env.INTERNAL_API_KEY || 'change-me-to-a-random-key';
  const TEST_RESTAURANT_ID = new Types.ObjectId().toString();
  const createdStockIds: string[] = [];

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

    // Acesso direto ao model Mongoose para setup/verificação
    stockModel = moduleFixture.get<Model<StockDocument>>(
      getModelToken(Stock.name),
    );
  });

  afterAll(async () => {
    // Cleanup: remove itens criados durante os testes
    if (createdStockIds.length > 0 && stockModel) {
      await stockModel.deleteMany({ _id: { $in: createdStockIds } }).exec();
    }
    if (app) {
      await app.close();
    }
  });

  it('deve aceitar PATCH /internal/stock/:id/adjust com x-internal-key válido', async () => {
    // Setup: cria item de estoque com 50 unidades
    const item = await stockModel.create({
      name: `Farinha Teste ${Date.now()}`,
      brand: 'Dona Benta',
      unit: 'kg',
      quantity: 50,
      minQuantity: 5,
      restaurantId: TEST_RESTAURANT_ID,
      userId: 'test-user-id',
    });
    const stockId = (item._id as Types.ObjectId).toString();
    createdStockIds.push(stockId);

    // Action: PATCH com chave interna válida
    const response = await request(app.getHttpServer())
      .patch(`/internal/stock/${stockId}/adjust`)
      .set('x-internal-key', INTERNAL_API_KEY)
      .set('x-tenant-id', TEST_RESTAURANT_ID)
      .send({ delta: -2 })
      .expect(200);

    // Assert: resposta reflete a nova quantidade
    expect(response.body).toHaveProperty('quantity', 48);

    // Assert: banco de dados foi atualizado de fato
    const updated = await stockModel.findById(stockId).lean().exec();
    expect(updated?.quantity).toBe(48);
  });

  it('deve rejeitar PATCH /internal/stock/:id/adjust sem x-internal-key', async () => {
    // Setup: cria item de estoque com 20 unidades
    const item = await stockModel.create({
      name: `Acúcar Teste ${Date.now()}`,
      brand: 'União',
      unit: 'kg',
      quantity: 20,
      minQuantity: 2,
      restaurantId: TEST_RESTAURANT_ID,
      userId: 'test-user-id',
    });
    const stockId = (item._id as Types.ObjectId).toString();
    createdStockIds.push(stockId);

    // Action: PATCH SEM o header x-internal-key → deve retornar 401
    await request(app.getHttpServer())
      .patch(`/internal/stock/${stockId}/adjust`)
      .set('x-tenant-id', TEST_RESTAURANT_ID)
      .send({ delta: -2 })
      .expect(401);

    // Assert: estoque NÃO foi alterado (validação ocorre antes do service)
    const unchanged = await stockModel.findById(stockId).lean().exec();
    expect(unchanged?.quantity).toBe(20);
  });
});
