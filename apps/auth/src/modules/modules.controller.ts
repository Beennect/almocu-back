import {
  Controller, Get, Post, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModulesService } from './modules.service';
import { AcquireModuleDto } from './dto/acquire-module.dto';
import { RolesGuard } from '@app/common';
import type { Request } from 'express';

@ApiTags('Modules')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @ApiOperation({ summary: 'Lista módulos premium disponíveis com status de aquisição' })
  @Get()
  async getModules(@Req() req: Request) {
    const restaurantId = req.user!.restaurantId || req.headers['x-tenant-id'] as string;
    return this.modulesService.getModules(restaurantId);
  }

  @ApiOperation({ summary: 'Ativa ou desativa um módulo premium para o restaurante' })
  @Post(':id/acquire')
  async acquireModule(
    @Param('id') moduleId: string,
    @Req() req: Request,
    @Body() dto: AcquireModuleDto,
  ) {
    const restaurantId = req.user!.restaurantId || req.headers['x-tenant-id'] as string;
    return this.modulesService.acquireModule(
      restaurantId,
      moduleId,
      req.user!.id,
      dto.active ?? true,
    );
  }
}
