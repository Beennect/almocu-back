import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '@app/common';
import { ExecutionContext } from '@nestjs/common';

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
