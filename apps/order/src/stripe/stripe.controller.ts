import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto } from './dto/checkout.dto';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Testar conexão com o Stripe',
    description:
      'Verifica se a integração com o Stripe está funcionando. Retorna um mock se a chave for fictícia.',
  })
  @ApiResponse({ status: 200, description: 'Conexão bem-sucedida' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async testConnection() {
    return this.stripeService.testConnection();
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Criar sessão de pagamento',
    description:
      'Cria uma sessão de Checkout no Stripe e retorna a URL de pagamento. O valor dos itens deve ser em centavos (ex: 2500 = R$ 25,00).',
  })
  @ApiResponse({
    status: 201,
    description: 'Sessão criada com sucesso',
    schema: {
      example: {
        success: true,
        url: 'https://checkout.stripe.com/pay/cs_test_...',
        sessionId: 'cs_test_...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Nenhum item fornecido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async createCheckout(@Body() body: CreateCheckoutDto) {
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('Nenhum item fornecido');
    }
    return this.stripeService.createCheckoutSession(
      body.items,
      body.successUrl,
      body.cancelUrl,
    );
  }

  @Get('verify/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Verificar status de pagamento',
    description:
      'Consulta diretamente a API do Stripe para verificar se uma sessão foi paga. Use o sessionId retornado pela rota de checkout.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID da sessão do Stripe (ex: cs_test_...)',
    example: 'cs_test_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Status da sessão retornado',
    schema: {
      example: {
        success: true,
        paymentStatus: 'paid',
        customerEmail: 'cliente@email.com',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'ID da sessão ausente' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async verifySession(@Param('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('ID da sessão ausente');
    }
    return this.stripeService.verifySession(sessionId);
  }
}
