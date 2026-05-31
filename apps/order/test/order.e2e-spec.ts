import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '@app/common';
import { ExecutionContext } from '@nestjs/common';

describe('OrderController (e2e)', () => {
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
              id: '6458f3f4e4b0c5e8d5f3a1b2',
              role: 'MANAGER',
              restaurantId: '6458f3f4e4b0c5e8d5f3a1b3',
            };
            return true;
          },
        })
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Failed to initialize Order E2E app:', error);
    }
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
