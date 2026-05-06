import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo pedido' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  create(
    @Headers('x-user-id') userId: string,
    @Headers('x-tenant-id') restaurantId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    if (!userId || !restaurantId) {
      throw new BadRequestException('User ID and Tenant ID are required');
    }
    return this.orderService.create(userId, restaurantId, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os pedidos do restaurante' })
  findAll(@Headers('x-tenant-id') restaurantId: string) {
    if (!restaurantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.orderService.findAllByRestaurant(restaurantId);
  }

  @Get('user')
  @ApiOperation({ summary: 'Lista todos os pedidos do usuário logado' })
  findAllByUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.orderService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um pedido pelo ID' })
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.orderService.findOne(id, userId, restaurantId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de um pedido' })
  updateStatus(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-tenant-id') restaurantId: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, userId, restaurantId, updateStatusDto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deleta um pedido' })
  remove(@Param('id') id: string, @Headers('x-tenant-id') restaurantId: string) {
    return this.orderService.remove(id, restaurantId);
  }
}
