import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  severity?: string;
}
