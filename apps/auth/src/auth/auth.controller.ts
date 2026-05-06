import {
  Controller, Post, Get, Body, UseGuards, Req,
  UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Realiza o login do usuário' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Login realizado com sucesso, retorna o token JWT e dados do usuário.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas ou conta inativa.' })
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user, loginDto.restaurantId);
  }

  @ApiOperation({ summary: 'Registra um novo usuário' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso.' })
  @ApiResponse({ status: 409, description: 'Usuário ou e-mail já existe.' })
  @Throttle({ default: { ttl: 60, limit: 3 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const { username, password, email, name } = registerDto;
    
    const exists = await this.usersService.findOneByUsername(username);
    if (exists) {
      throw new ConflictException('Usuário já existe');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
      email,
      name,
      globalRoles: ['user'],
    });

    const { password: _, ...result } = user.toJSON ? user.toJSON() : user;
    return result;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca o restaurante (tenant) ativo' })
  @ApiBody({ type: SwitchTenantDto })
  @ApiResponse({ status: 201, description: 'Tenant alterado com sucesso, retorna um novo token com o contexto atualizado.' })
  @ApiResponse({ status: 403, description: 'Usuário não tem acesso ao restaurante solicitado.' })
  @UseGuards(AuthGuard('jwt'))
  @Post('switch-tenant')
  async switchTenant(@Req() req, @Body() switchTenantDto: SwitchTenantDto) {
    return this.authService.switchTenant(req.user, switchTenantDto.restaurantId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Realiza logout (invalida o token)' })
  @ApiResponse({ status: 201, description: 'Logout realizado e token adicionado à blacklist.' })
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

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado e seu contexto atual' })
  @ApiResponse({ status: 200, description: 'Dados do perfil do usuário e tenant ativo.' })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Req() req) {
    try {
      const user = req.user;
      return {
        id: user.id || user.sub,
        username: user.username,
        globalRoles: user.globalRoles,
        restaurantId: user.restaurantId,
        activeRole: user.role,
      };
    } catch (error) {
      console.error('ERRO NO GET ME:', error);
      throw error;
    }
  }
}
