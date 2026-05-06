import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { UserRestaurant } from '../users/schemas/user-restaurant.schema';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let redisService: RedisService;

  const mockUsersService = {
    findOneByUsername: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
  };

  const mockRedisService = {
    addToBlacklist: jest.fn(),
    isBlacklisted: jest.fn(),
  };

  const mockUserRestaurantModel = {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    }),
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
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
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
        toObject: jest.fn().mockReturnValue({
          id: '507f1f77bcf86cd799439011',
          username: 'testuser',
          email: 'test@test.com',
          roles: ['user'],
        }),
      };
      mockUsersService.findOneByUsername.mockResolvedValue(mockUser);

      const result = await authService.validateUser('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.password).toBeUndefined();
      expect(mockUsersService.findOneByUsername).toHaveBeenCalledWith('testuser');
    });

    it('deve retornar null quando senha é inválida', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '1',
        username: 'testuser',
        password: hashedPassword,
      };
      mockUsersService.findOneByUsername.mockResolvedValue(mockUser);

      const result = await authService.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('deve retornar null quando usuário não existe', async () => {
      mockUsersService.findOneByUsername.mockResolvedValue(null);

      const result = await authService.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('deve retornar access_token e setar restaurantId se tiver apenas 1 allowedRestaurant', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@test.com',
        name: 'Test User',
        roles: ['user'],
      };
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');
      mockUserRestaurantModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { restaurantId: { _id: '507f191e810c19729de860ea', name: 'Restaurante A', status: 'active' }, role: 'admin' }
          ]),
        }),
      });

      const result = await authService.login(mockUser);

      expect(result.access_token).toBe('mocked-jwt-token');
      expect(result.user.id).toBe('507f1f77bcf86cd799439011');
      expect(result.user.username).toBe('testuser');
      expect(result.user.activeRestaurantId).toBe('507f191e810c19729de860ea');
      expect(result.user.needsRestaurantSelection).toBe(false);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          _id: '507f1f77bcf86cd799439011',
          sub: '507f1f77bcf86cd799439011',
          restaurantId: '507f191e810c19729de860ea',
          role: 'admin'
        }),
      );
    });

    it('deve deixar restaurantId nulo e exigir seleção de filial se tiver mais de 1', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@test.com',
        name: 'Test User',
        roles: ['user'],
      };
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');
      mockUserRestaurantModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { restaurantId: { _id: '507f191e810c19729de860ea', name: 'Restaurante A', status: 'active' }, role: 'admin' },
            { restaurantId: { _id: '507f191e810c19729de860eb', name: 'Restaurante B', status: 'active' }, role: 'user' }
          ]),
        }),
      });

      const result = await authService.login(mockUser);

      expect(result.user.activeRestaurantId).toBeNull();
      expect(result.user.needsRestaurantSelection).toBe(true);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: null,
        }),
      );
    });
  });

  describe('logout', () => {
    it('deve adicionar token na blacklist do Redis com TTL correto', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // expira em 1 hora
      const token = 'valid-token-123';

      mockJwtService.decode.mockReturnValue({ exp: futureExp });
      mockRedisService.addToBlacklist.mockResolvedValue(undefined);

      await authService.logout(token);

      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
      expect(mockRedisService.addToBlacklist).toHaveBeenCalledWith(
        token,
        expect.any(Number),
      );

      // Verifica que o TTL é aproximadamente 3600 (com margem de 5s)
      const ttlUsed = mockRedisService.addToBlacklist.mock.calls[0][1];
      expect(ttlUsed).toBeGreaterThan(3590);
      expect(ttlUsed).toBeLessThanOrEqual(3600);
    });

    it('não deve adicionar na blacklist se token já expirou', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100; // expirou há 100s
      const token = 'expired-token';

      mockJwtService.decode.mockReturnValue({ exp: pastExp });

      await authService.logout(token);

      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });

    it('não deve quebrar se o decode falhar', async () => {
      const token = 'garbage-token';

      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Não deve lançar exceção
      await expect(authService.logout(token)).resolves.not.toThrow();
      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });

    it('não deve adicionar na blacklist se decode retorna null', async () => {
      const token = 'null-decode-token';
      mockJwtService.decode.mockReturnValue(null);

      await authService.logout(token);

      expect(mockRedisService.addToBlacklist).not.toHaveBeenCalled();
    });
  });
});
