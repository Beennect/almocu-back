import {
  Controller, Post, Get, Body, UseGuards, Req, Res,
  ConflictException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags, ApiOperation, ApiBody,
  ApiBearerAuth, ApiResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthGuard } from './google-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id?: string;
    sub?: string;
    username: string;
    globalRoles: string[];
    restaurantId?: string;
    role?: string;
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @ApiOperation({ summary: 'Realiza o login do usuário' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token JWT e dados do usuário.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas ou conta inativa.' })
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Req() req: AuthenticatedRequest, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user, loginDto.restaurantId);
  }

  @ApiOperation({ summary: 'Registra um novo usuário' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso.' })
  @ApiResponse({ status: 409, description: 'Usuário ou e-mail já existe.' })
  @Throttle({ default: { ttl: 60, limit: 3 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const [existingUsername, existingEmail] = await Promise.all([
      this.usersService.findOneByUsername(registerDto.username),
      this.usersService.findOneByEmail(registerDto.email),
    ]);

    if (existingUsername) throw new ConflictException('Usuário já existe');
    if (existingEmail) throw new ConflictException('E-mail já cadastrado');

    return this.authService.register(registerDto);
  }


  @ApiBearerAuth()
  @ApiOperation({ summary: 'Realiza logout (invalida o token)' })
  @ApiResponse({ status: 200, description: 'Token adicionado à blacklist.' })
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
    return { message: 'Logout realizado com sucesso' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil do usuário e tenant ativo.' })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    const { id, sub, username, globalRoles, restaurantId, role } = req.user;
    return {
      id: id ?? sub,
      username,
      globalRoles,
      restaurantId,
      activeRole: role,
    };
  }

  @ApiOperation({ summary: 'Inicia o fluxo de login pelo Google. Aceita ?redirect_uri para mobile.' })
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: Request) {
    // Redireciona para o Google
  }

  @ApiOperation({ summary: 'Callback do Google para completar o login. Redireciona para o app se houver state.' })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const loginData = await this.authService.login(req.user);
    
    // O Google devolve o que passamos no 'state' como query parameter
    const redirectUri = req.query.state as string;
    
    if (redirectUri) {
      // Redireciona para o App (Deep Link) com o token
      // Ex: exp://127.0.0.1:8081/--/login?token=ey...
      const separator = redirectUri.includes('?') ? '&' : '?';
      return res.redirect(`${redirectUri}${separator}token=${loginData.access_token}`);
    }

    // Se não houver redirect_uri, retorna o JSON padrão
    return res.json(loginData);
  }
}