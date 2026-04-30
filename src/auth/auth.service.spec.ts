import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
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
        id: '1',
        username: 'testuser',
        password: hashedPassword,
        email: 'test@test.com',
        roles: ['user'],
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
    it('deve retornar access_token e dados do usuário', async () => {
      const mockUser = {
        id: 'user-id-123',
        username: 'testuser',
        email: 'test@test.com',
        name: 'Test User',
        roles: ['user'],
        restaurantId: 'rest-id-456',
      };
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await authService.login(mockUser);

      expect(result.access_token).toBe('mocked-jwt-token');
      expect(result.user.id).toBe('user-id-123');
      expect(result.user.username).toBe('testuser');
      expect(result.user.restaurantId).toBe('rest-id-456');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          _id: 'user-id-123',
          sub: 'user-id-123',
          roles: ['user'],
          restaurantId: 'rest-id-456',
        }),
      );
    });

    it('deve usar restaurantId fallback quando não fornecido', async () => {
      const mockUser = {
        id: 'user-id-123',
        username: 'testuser',
        email: 'test@test.com',
        name: 'Test User',
        roles: ['user'],
      };
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await authService.login(mockUser);

      expect(result.user.restaurantId).toBe('65df12345678901234567890');
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
