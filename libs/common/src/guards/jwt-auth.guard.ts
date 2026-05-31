import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que protege rotas exigindo um JWT Bearer válido.
 * Basta colocar @UseGuards(JwtAuthGuard) em qualquer controller.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
