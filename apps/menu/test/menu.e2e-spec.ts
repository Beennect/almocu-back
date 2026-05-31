import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '@app/common';
import { ExecutionContext } from '@nestjs/common';

describe('MenuController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest();
            req.user = {
              id: 'test-user-id',
              role: 'MANAGER',
              restaurantId: 'test-restaurant-id',
            };
            return true;
          },
        })
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Failed to initialize Menu E2E app:', error);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/products (GET)', () => {
    return request(app.getHttpServer()).get('/products').expect(200);
  });
});
