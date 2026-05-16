import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Failed to initialize Auth E2E app:', error);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET) - health check', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });
});
