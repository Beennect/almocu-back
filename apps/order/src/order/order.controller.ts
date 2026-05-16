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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';

@ApiTags('orders')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description:
    'ID do restaurante para contexto multi-tenant (opcional, sobrescreve o do token)',
  required: false,
})
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo pedido' })
  create(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    const token = req.headers.authorization;
    return this.orderService.create(
      req.user.id,
      req.user.restaurantId,
      createOrderDto,
      token,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os pedidos do restaurante' })
  findAll(@Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.orderService.findAllByRestaurant(restaurantId);
  }

  @Get('user')
  @ApiOperation({ summary: 'Lista todos os pedidos do usuário logado' })
  findAllByUser(@Req() req: any) {
    const userId = req.user.id;
    return this.orderService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um pedido pelo ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    return this.orderService.findOne(id, userId, restaurantId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de um pedido' })
  updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    return this.orderService.updateStatus(
      id,
      userId,
      restaurantId,
      updateStatusDto.status,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deleta um pedido' })
  remove(@Param('id') id: string, @Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.orderService.remove(id, restaurantId);
  }
}
