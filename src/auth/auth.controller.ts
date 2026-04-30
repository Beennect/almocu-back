import { Controller, Post, Body, Get, Req, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import * as oidc from 'openid-client';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  private config: oidc.Configuration;

  constructor(private configService: ConfigService) {}

  private async getOidcConfig() {
    if (this.config) return this.config;

    const issuer = this.configService.get<string>('ZITADEL_ISSUER') || 'http://zitadel:8080';
    const clientId = this.configService.get<string>('ZITADEL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZITADEL_CLIENT_SECRET');

    if (!clientId) {
      throw new InternalServerErrorException('ZITADEL_CLIENT_ID is not defined in environment');
    }

    try {
      this.config = await oidc.discovery(
        new URL(issuer),
        clientId,
        clientSecret,
        undefined,
        { execute: [oidc.allowInsecureRequests] }
      );
      return this.config;
    } catch (error) {
      console.error('Failed to discover OIDC config:', error);
      throw new InternalServerErrorException('Authentication service unreachable');
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const { username, password } = body;
    const config = await this.getOidcConfig();

    try {
      // Usando genericGrantRequest para o fluxo 'password' na v6
      const tokens = await oidc.genericGrantRequest(
        config,
        'password',
        {
          username,
          password,
          scope: 'openid profile email',
        },
      );

      return {
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      };
    } catch (error) {
      console.error('Zitadel login failed:', error);
      throw new UnauthorizedException('Invalid credentials or grant type not enabled in Zitadel');
    }
  }

  @Get('me')
  async me(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();

    const accessToken = authHeader.split(' ')[1];
    const config = await this.getOidcConfig();

    try {
      const userinfo = await oidc.fetchUserInfo(config, accessToken, '');
      return userinfo;
    } catch (error) {
       throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
