import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import {
  ModuleAcquisition,
  ModuleAcquisitionSchema,
} from './module-acquisition.schema';
import {
  Restaurant,
  RestaurantSchema,
} from '../restaurants/restaurant.schema';
import {
  UserRestaurant,
  UserRestaurantSchema,
} from '../users/user-restaurant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModuleAcquisition.name, schema: ModuleAcquisitionSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: UserRestaurant.name, schema: UserRestaurantSchema },
    ]),
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
