import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { OrderPageDto } from './dto/order-page.dto';
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

@ApiTags('orders')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo pedido' })
  @Roles('WAITER', 'KITCHEN', 'OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Garçons, cozinheiros, gerentes e proprietários',
  })
  create(
    @Req() req: any,
    @Body() createOrderDto: CreateOrderDto,
    @RestaurantId() restaurantId: string,
  ) {
    const token = req.headers.authorization;
    return this.orderService.create(
      req.user.id,
      req.user.role,
      restaurantId,
      createOrderDto,
      token,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista todos os pedidos do restaurante com paginação',
  })
  @Roles('KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Cozinheiros, entregadores, gerentes e proprietários',
  })
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
    type: OrderPageDto,
    description: 'Lista paginada de pedidos do restaurante',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.orderService.findAllByRestaurant(restaurantId, pageable);
  }

  @Get('staff-performance')
  @ApiOperation({ summary: 'Estatísticas de performance por funcionário' })
  @Roles('OWNER', 'MANAGER')
  getStaffPerformance(@RestaurantId() restaurantId: string) {
    return this.orderService.getStaffPerformance(restaurantId);
  }

  @ApiOperation({
    summary: 'Lista todos os pedidos do usuário logado com paginação',
  })
  @Get('user')
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
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
    type: OrderPageDto,
    description: 'Lista paginada de pedidos do usuário',
  })
  findAllByUser(@Req() req: any, @PageableParams() pageable: Pageable) {
    return this.orderService.findAllByUser(req.user.id, pageable, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um pedido pelo ID' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findOne(
    @Param('id') id: string,
    @Req() req: any,
    @RestaurantId() restaurantId: string,
  ) {
    return this.orderService.findOne(
      id,
      req.user.id,
      req.user.role,
      restaurantId,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de um pedido' })
  @Roles('KITCHEN', 'CASHIER', 'DELIVERY', 'OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Restrito por função (ver documentação interna)',
  })
  updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.orderService.updateStatus(
      id,
      restaurantId,
      updateStatusDto.status,
      req.user.role,
      req.user.id,
      updateStatusDto.deliveryUserId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deleta um pedido' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.orderService.remove(id, restaurantId);
  }
}
