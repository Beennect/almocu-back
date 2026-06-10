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
import { TableService } from './table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablePageDto } from './dto/table-page.dto';
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

@ApiTags('tables')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova mesa' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  create(
    @Req() req: any,
    @Body() createTableDto: CreateTableDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.tableService.create(restaurantId, createTableDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista todas as mesas do restaurante com paginação',
  })
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
    type: TablePageDto,
    description: 'Lista paginada de mesas',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.tableService.findAll(restaurantId, pageable);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Lista todas as mesas ativas (sem paginação)',
  })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findAllActive(@RestaurantId() restaurantId: string) {
    return this.tableService.findAllActive(restaurantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma mesa pelo ID' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findOne(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.tableService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma mesa' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  update(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.tableService.update(id, restaurantId, updateTableDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativa uma mesa (soft delete)' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  remove(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.tableService.remove(id, restaurantId);
  }
}
