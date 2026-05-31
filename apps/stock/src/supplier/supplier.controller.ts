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
import { Request } from 'express';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierPageDto } from './dto/supplier-page.dto';
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

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    _id: string;
    username: string;
    globalRoles: string[];
    restaurantId?: string;
    role?: string;
  };
}

@ApiTags('suppliers')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo fornecedor' })
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @Req() req: AuthenticatedRequest,
    @RestaurantId() restaurantId: string,
  ) {
    return this.supplierService.create(
      createSupplierDto,
      req.user.id,
      restaurantId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lista fornecedores com paginação' })
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
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
    type: SupplierPageDto,
    description: 'Lista paginada de fornecedores',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.supplierService.findAll(restaurantId, pageable);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um fornecedor específico' })
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.supplierService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados de um fornecedor' })
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.supplierService.update(id, updateSupplierDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um fornecedor' })
  @ApiForbiddenResponse({
    description: 'Apenas proprietários e gerentes',
  })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.supplierService.remove(id, restaurantId);
  }
}
