import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { NfeImport, NfeImportSchema } from './nfe-import.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfeImport.name, schema: NfeImportSchema },
    ]),
  ],
  controllers: [NfeController],
  providers: [NfeService],
})
export class NfeModule {}
