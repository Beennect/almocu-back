import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthModule } from '@app/common';
import { TableService } from './table.service';
import { TableController } from './table.controller';
import { Table, TableSchema } from './table.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Table.name, schema: TableSchema }]),
    JwtAuthModule,
  ],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}
