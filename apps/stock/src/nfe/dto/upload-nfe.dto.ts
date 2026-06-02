import { ApiProperty } from '@nestjs/swagger';

export class UploadNfeDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Arquivo XML da NF-e',
  })
  file: Express.Multer.File;
}
