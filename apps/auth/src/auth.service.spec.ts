import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users/users.service';
import { RedisService } from './redis/redis.service';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { UserRestaurant } from './users/user-restaurant.schema';

describe('AuthService', () => {
  let authService: AuthService;

  const mockUsersService = {
    findOneByUsername: mock(() => Promise.resolve(null)),
  };

  const mockJwtService = {
    sign: mock(() => ''),
    decode: mock(() => null),
  };

  const mockRedisService = {
    addToBlacklist: mock(() => Promise.resolve()),
    isBlacklisted: mock(() => Promise.resolve(false)),
  };

  const mockUserRestaurantModel = {
    find: mock(() => ({
      populate: mock(() => ({
        exec: mock(() => Promise.resolve([])),
      })),
    })),
    findOne: mock(() => ({
      populate: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: getModelToken(UserRestaurant.name),
          useValue: mockUserRestaurantModel,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    mockUsersService.findOneByUsername.mockClear();
    mockJwtService.sign.mockClear();
    mockJwtService.decode.mockClear();
    mockRedisService.addToBlacklist.mockClear();
    mockRedisService.isBlacklisted.mockClear();
    mockUserRestaurantModel.find.mockClear();
    mockUserRestaurantModel.findOne.mockClear();
  });

  describe('validateUser', () => {
    it('deve retornar o usuário sem a senha quando credenciais são válidas', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        password: hashedPassword,
        email: 'test@test.com',
        isActive: true,
        roles: ['user'],
        toObject: mock(() => ({
          id: '507f1f77bcf86cd799439011',
          username: 'testuser',
          email: 'test@test.com',
          roles: ['user'],
        })),
      };
      mockUsersService.findOneByUsername.mockImplementation(() =>
        Promise.resolve(mockUser),
      );

      const result = await authService.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.password).toBeUndefined();
      expect(mockUsersService.findOneByUsername).toHaveBeenCalledWith(
        'testuser',
      );
    });

    it('deve retornar null quando senha é inválida', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '1',
        username: 'testuser',
        password: hashedPassword,
      };
      mockUsersService.findOneByUsername.mockImplementation(() =>
        Promise.resolve(mockUser),
      );

      const result = await authService.validateUser(
        'testuser',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('deve retornar null quando usuário não existe', async () => {
      mockUsersService.findOneByUsername.mockImplementation(() =>
        Promise.resolve(null),
      );

      const result = await authService.validateUser(
        'nonexistent',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('deve retornar access_token neutro e listar os restaurantes permitidos', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@test.com',
        name: 'Test User',
        globalRoles: ['user'],
      };
      mockJwtService.sign.mockImplementation(() => 'mocked-jwt-token');
      mockUserRestaurantModel.find.mockImplementation(() => ({
        populate: mock(() => ({
          exec: mock(() =>
            Promise.resolve([
              {
                restaurantId: {
                  _id: '507f191e810c19729de860ea',
                  name: 'Restaurante A',
                  status: 'active',
                },
                role: 'admin',
              },
            ]),
          ),
        })),
      }));

      const result = await authService.login(mockUser);

      expect(result.access_token).toBe('mocked-jwt-token');
      expect(result.user.id).toBe('507f1f77bcf86cd799439011');
      expect(result.user.username).toBe('testuser');
      expect(result.user.restaurants.length).toBe(1);
      expect(result.user.restaurants[0].id).toBe('507f191e810c19729de860ea');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          _id: '507f1f77bcf86cd799439011',
          sub: '507f1f77bcf86cd799439011',
          restaurantId: null,
          role: null,
        }),
      );
    });
  });

  describe('logout', () => {
    it('deve adicionar token na blacklist do Redis com TTL correto', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // expira em 1 hora
      const token = 'valid-token-123';

      mockJwtService.decode.mockImplementation(() => ({ exp: futureExp }));
      mockRedisService.addToBlacklist.mockImplementation(() =>
        Promise.resolve(),
      );

      await authService.logout(token);

      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
      expect(mockRedisService.addToBlacklist).toHaveBeenCalledWith(
        token,
        expect.any(Number),
      );

      const ttlUsed = mockRedisService.addToBlacklist.mock.calls[0][1];
      expect(ttlUsed).toBeGreaterThan(3590);
      expect(ttlUsed).toBeLessThanOrEqual(3600);
    });

    it('não deve adicionar na blacklist se token já expirou', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100; // expirou há 100s
      const token = 'expired-token';

      mockJwtService.decode.mockImplementation(() => ({ exp: pastExp }));

      await authService.logout(token);

      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });

    it('não deve quebrar se o decode falhar', async () => {
      const token = 'garbage-token';

      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authService.logout(token);
      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });

    it('não deve adicionar na blacklist se decode retorna null', async () => {
      const token = 'null-decode-token';
      mockJwtService.decode.mockImplementation(() => null);

      await authService.logout(token);

      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });
  });
});
