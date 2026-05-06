import { Controller, Post, Body, Get, UseGuards, Req, Patch, Param, Delete, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto, CreateBranchDto } from './dto/create-restaurant.dto';
import { JoinRestaurantDto } from './dto/join-restaurant.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user-restaurant.schema';

@ApiTags('Restaurants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @ApiOperation({ summary: 'Cria um novo restaurante master (Matriz)' })
  @ApiBody({ type: CreateRestaurantDto })
  @Post()
  async create(@Req() req, @Body() createDto: CreateRestaurantDto) {
    return this.restaurantsService.create(
      createDto.name, 
      createDto.cnpj, 
      req.user.id, 
      createDto.maxBranches
    );
  }

  @ApiOperation({ summary: 'Cria uma nova filial vinculada a um restaurante master' })
  @ApiBody({ type: CreateBranchDto })
  @Post('branch')
  async createBranch(@Req() req, @Body() createDto: CreateBranchDto) {
    return this.restaurantsService.createBranch(createDto.name, createDto.parentId, req.user.id);
  }

  @ApiOperation({ summary: 'Entra em um restaurante usando um código de convite' })
  @ApiBody({ type: JoinRestaurantDto })
  @Post('join')
  async join(@Req() req, @Body() joinDto: JoinRestaurantDto) {
    return this.restaurantsService.joinWithInviteCode(joinDto.inviteCode, req.user.id);
  }

  @ApiOperation({ summary: 'Lista os restaurantes aos quais o usuário pertence' })
  @Get('my')
  async getMyRestaurants(@Req() req) {
    return this.restaurantsService.findUserRestaurants(req.user.id);
  }

  @ApiOperation({ summary: 'Lista os funcionários do restaurante atual' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get(':id/staff')
  async getStaff(@Param('id') restaurantId: string, @Req() req) {
    // Valida se o usuário está acessando o restaurante correto do seu token
    if (req.user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Você não tem acesso a este contexto de restaurante');
    }
    return this.restaurantsService.listStaff(restaurantId);
  }

  @ApiOperation({ summary: 'Altera o cargo de um funcionário' })
  @ApiBody({ schema: { properties: { role: { type: 'string', enum: Object.values(UserRole) } } } })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id/staff/:userId')
  async updateStaff(
    @Param('id') restaurantId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { role: UserRole },
    @Req() req
  ) {
    if (req.user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Você não tem acesso a este contexto de restaurante');
    }
    return this.restaurantsService.updateStaffRole(restaurantId, targetUserId, body.role);
  }

  @ApiOperation({ summary: 'Remove um funcionário da equipe' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(':id/staff/:userId')
  async removeStaff(
    @Param('id') restaurantId: string,
    @Param('userId') targetUserId: string,
    @Req() req
  ) {
    if (req.user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Você não tem acesso a este contexto de restaurante');
    }
    return this.restaurantsService.removeStaff(restaurantId, targetUserId);
  }
}
