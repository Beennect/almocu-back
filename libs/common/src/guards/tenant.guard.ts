import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const restaurantId = request.headers['x-restaurant-id'];
    const authHeader = request.headers['authorization'];

    if (!restaurantId) {
      throw new UnauthorizedException('O cabeçalho x-restaurant-id é obrigatório');
    }

    if (!authHeader) {
      throw new UnauthorizedException('Token de autorização não encontrado');
    }

    const authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3000';

    try {
      // Chama o serviço de autenticação para validar o vínculo do usuário com o restaurante
      const response = await firstValueFrom(
        this.httpService.get(`${authServiceUrl}/auth/validate-tenant`, {
          params: { restaurantId },
          headers: { Authorization: authHeader },
        }),
      );

      // Se o serviço de autenticação retornar 200, anexamos os dados do tenant à requisição
      request.tenant = response.data;
      // Também garantimos que o req.user.restaurantId seja o validado
      if (request.user) {
        request.user.restaurantId = restaurantId;
        request.user.role = response.data.role;
      }

      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new UnauthorizedException(error.response.data?.message || 'Acesso negado ao restaurante');
      }
      throw new InternalServerErrorException('Erro ao validar permissões do restaurante');
    }
  }
}
