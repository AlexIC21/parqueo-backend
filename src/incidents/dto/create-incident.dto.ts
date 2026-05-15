import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  parkingLotId: number;
}
