import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Restaurants (e2e)', () => {
  let app: INestApplication;
  let mongooseConnection: Connection;
  let accessToken: string;
  let masterRestaurantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    mongooseConnection = app.get(getConnectionToken());
    
    // Setup: Registrar e Logar para pegar o token
    const username = `testuser_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username,
        password: 'Password123!',
        email: `${username}@example.com`,
        name: 'Test User',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username,
        password: 'Password123!',
      });
    
    accessToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Limpar dados de teste se necessário (opcional para e2e em dev)
    // await mongooseConnection.db.dropDatabase();
    await app.close();
  });

  describe('Criação e Limite de Filiais', () => {
    it('deve criar um restaurante matriz com limite de 2 filiais', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Matriz TDD',
          cnpj: '11.222.333/0001-99',
          maxBranches: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Matriz TDD');
      expect(res.body.maxBranches).toBe(2);
      masterRestaurantId = res.body._id;
    });

    it('deve permitir criar a primeira filial', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurants/branch')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Filial 1 TDD',
          parentId: masterRestaurantId,
        });

      expect(res.status).toBe(201);
    });

    it('deve permitir criar a segunda filial', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurants/branch')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Filial 2 TDD',
          parentId: masterRestaurantId,
        });

      expect(res.status).toBe(201);
    });

    it('deve FALHAR ao tentar criar a terceira filial (limite excedido)', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurants/branch')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Filial 3 TDD',
          parentId: masterRestaurantId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Limite de filiais atingido');
    });
  });
});
