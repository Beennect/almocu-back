import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('OrderController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/orders/user (GET)', () => {
    // Note: This will fail if no user is authenticated or DB is empty,
    // but it serves to test the endpoint response structure.
    return request(app.getHttpServer())
      .get('/orders/user')
      .expect(401); // Unauthorized is expected since we don't have a token here
  });
});
