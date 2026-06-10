import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BillSplitService } from './bill-split.service';
import { CreateBillSplitDto, PayBillSplitDto } from './dto/create-bill-split.dto';
import { BillSplitPageDto } from './dto/bill-split-page.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  PageableParams,
  RestaurantId,
} from '@app/common';
import { Roles } from '@app/common';
import type { Pageable } from '@app/common';

@ApiTags('bill-splits')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bill-splits')
export class BillSplitController {
  constructor(private readonly billSplitService: BillSplitService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um split de conta a partir de um pedido' })
  @Roles('WAITER', 'OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Garçons, gerentes e proprietários',
  })
  create(
    @Req() req: any,
    @Body() createBillSplitDto: CreateBillSplitDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.billSplitService.create(restaurantId, createBillSplitDto);
  }

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Lista todos os splits de um pedido',
  })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER', 'CASHIER')
  findByOrder(
    @Param('orderId') orderId: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.billSplitService.findByOrder(orderId, restaurantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista todos os splits do restaurante com paginação',
  })
  @Roles('OWNER', 'MANAGER', 'CASHIER')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número da página (padrão: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Itens por página (padrão: 10, máximo: 100)',
    example: 10,
  })
  @ApiOkResponse({
    type: BillSplitPageDto,
    description: 'Lista paginada de splits',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.billSplitService.findAllByRestaurant(restaurantId, pageable);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Gera link de pagamento Stripe para um split',
  })
  @Roles('WAITER', 'CASHIER', 'OWNER', 'MANAGER')
  pay(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.billSplitService.pay(id, restaurantId);
  }

  @Post('confirm/:sessionId')
  @ApiOperation({
    summary: 'Confirma pagamento de um split via sessionId do Stripe',
    description:
      'Verifica o status da sessão no Stripe e atualiza o split. Se todos os splits do pedido estiverem pagos, atualiza o pedido como pago.',
  })
  @Roles('CASHIER', 'OWNER', 'MANAGER', 'WAITER')
  confirmPayment(
    @Param('sessionId') sessionId: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.billSplitService.confirmPayment(sessionId, restaurantId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancela um split pendente',
  })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  cancel(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.billSplitService.cancel(id, restaurantId);
  }
}
