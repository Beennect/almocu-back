import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Patch,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import {
  CreateRestaurantDto,
  CreateBranchDto,
} from './dto/create-restaurant.dto';
import { Plan } from './restaurant.schema';
import { JoinRestaurantDto } from './dto/join-restaurant.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { UserRole, RolesGuard, Roles } from '@app/common';
import type { Request } from 'express';
import { PageableParams } from '@app/common';
import type { Pageable } from '@app/common';

@ApiTags('Restaurants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @ApiOperation({ summary: 'Cria um novo restaurante master (Matriz)' })
  @ApiBody({ type: CreateRestaurantDto })
  @Post()
  async create(@Req() req: Request, @Body() createDto: CreateRestaurantDto) {
    return this.restaurantsService.create(
      createDto.name,
      createDto.cnpj,
      req.user!.id,
      createDto.plan ?? Plan.BASIC,
    );
  }

  @ApiOperation({
    summary: 'Cria uma nova filial vinculada a um restaurante master',
  })
  @ApiBody({ type: CreateBranchDto })
  @Roles(UserRole.OWNER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER pode criar filiais' })
  @Post('branch')
  async createBranch(@Req() req: Request, @Body() createDto: CreateBranchDto) {
    return this.restaurantsService.createBranch(
      createDto.name,
      createDto.parentId,
      req.user!.id,
    );
  }

  @ApiOperation({
    summary: 'Entra em um restaurante usando um código TOTP de convite',
  })
  @ApiBody({ type: JoinRestaurantDto })
  @Post('join')
  async join(@Req() req: Request, @Body() joinDto: JoinRestaurantDto) {
    return this.restaurantsService.joinWithInviteCode(
      joinDto.inviteCode,
      req.user!.id,
    );
  }

  @ApiOperation({
    summary:
      'Retorna o código TOTP atual do restaurante e o tempo restante (segundos)',
  })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER e MANAGER' })
  @Get(':id/invite-code')
  async getInviteCode(@Param('id') restaurantId: string, @Req() req: Request) {
    return this.restaurantsService.getCurrentInviteCode(
      restaurantId,
      req.user!.id,
    );
  }

  @ApiOperation({
    summary: 'Lista os restaurantes aos quais o usuário pertence',
  })
  @Get('my')
  async getMyRestaurants(@Req() req: Request) {
    return this.restaurantsService.findUserRestaurants(req.user!.id);
  }

  @ApiOperation({ summary: 'Lista os funcionários do restaurante atual' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER e MANAGER' })
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
  @Get(':id/staff')
  async getStaff(
    @Param('id') restaurantId: string,
    @Req() req: Request,
    @PageableParams() pageable: Pageable,
  ) {
    return this.restaurantsService.listStaff(
      restaurantId,
      req.user!.id,
      pageable,
    );
  }

  @ApiOperation({ summary: 'Altera o cargo de um funcionário' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER e MANAGER' })
  @ApiBody({
    schema: {
      properties: { role: { type: 'string', enum: Object.values(UserRole) } },
    },
  })
  @Patch(':id/staff/:userId')
  async updateStaff(
    @Param('id') restaurantId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { role: UserRole },
    @Req() req: Request,
  ) {
    return this.restaurantsService.updateStaffRole(
      restaurantId,
      targetUserId,
      body.role,
      req.user!.id,
    );
  }

  @ApiOperation({ summary: 'Remove um funcionário da equipe' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER e MANAGER' })
  @Delete(':id/staff/:userId')
  async removeStaff(
    @Param('id') restaurantId: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ) {
    return this.restaurantsService.removeStaff(
      restaurantId,
      targetUserId,
      req.user!.id,
    );
  }

  @ApiOperation({
    summary: 'Suspende um restaurante (soft delete)',
    description:
      'Apenas o proprietário pode suspender. Se for matriz, suspende também as filiais. Desativa todos os vínculos de usuários.',
  })
  @Roles(UserRole.OWNER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER' })
  @Delete(':id')
  @HttpCode(200)
  async suspend(
    @Param('id') restaurantId: string,
    @Req() req: Request,
  ) {
    return this.restaurantsService.suspend(restaurantId, req.user!.id);
  }

  @ApiOperation({
    summary: 'Reativa um restaurante suspenso',
    description:
      'Regenera a chave TOTP por segurança. Reativa os vínculos de usuários.',
  })
  @Roles(UserRole.OWNER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER' })
  @Patch(':id/reactivate')
  async reactivate(
    @Param('id') restaurantId: string,
    @Req() req: Request,
  ) {
    return this.restaurantsService.reactivate(restaurantId, req.user!.id);
  }

  @ApiOperation({
    summary: 'Atualiza as funcionalidades do restaurante',
    description:
      'Permite ativar/desativar funcionalidades como sistema de mesas. Apenas o proprietário pode alterar.',
  })
  @Roles(UserRole.OWNER)
  @ApiForbiddenResponse({ description: 'Apenas OWNER' })
  @Patch(':id/features')
  async updateFeatures(
    @Param('id') restaurantId: string,
    @Req() req: Request,
    @Body() featuresDto: UpdateFeaturesDto,
  ) {
    return this.restaurantsService.updateFeatures(
      restaurantId,
      req.user!.id,
      featuresDto,
    );
  }
}
