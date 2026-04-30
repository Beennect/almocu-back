import {
  Controller, Post, Get, Body, UseGuards, Req,
  UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() body: any) {
    const { username, password, email, name, roles } = body;
    
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
    });

    const { password: _, ...result } = user;
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req) {
    return req.user;
  }
}
