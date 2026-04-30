import {
  Controller, Post, Get, Body, UseGuards, Req,
  UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  // Rate limit mais agressivo no login: 5 tentativas por 60 segundos
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req) {
    return this.authService.login(req.user);
  }

  // Rate limit mais agressivo no register: 3 registros por 60 segundos
  @Throttle({ default: { ttl: 60, limit: 3 } })
  @Post('register')
  async register(@Body() body: any) {
    const { username, password, email, name, roles, allowedRestaurants } = body;
    
    // Verifica se usuário já existe
    const exists = await this.usersService.findOneByUsername(username);
    if (exists) {
      throw new ConflictException('Usuário já existe');
    }

    // Hash da senha antes de salvar
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
      email,
      name,
      roles: roles || ['user'],
      allowedRestaurants: allowedRestaurants || [],
    });

    const { password: _, ...result } = user;
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('switch-tenant')
  async switchTenant(@Req() req, @Body() body: { restaurantId: string }) {
    if (!body.restaurantId) {
      throw new UnauthorizedException('ID do restaurante é obrigatório');
    }
    return this.authService.switchTenant(req.user, body.restaurantId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await this.authService.logout(token);
    }
    return { message: 'Logout realizado com sucesso' };
  }

  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req) {
    return req.user;
  }
}
