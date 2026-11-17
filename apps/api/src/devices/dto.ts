import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class SimDto {
  @IsString() @Matches(/^\d{18,22}F?$/i, { message: 'ICCID inválido (18 a 22 dígitos)' }) iccid: string;
  @IsOptional() @IsString() @Matches(/^\+?\d{10,15}$/, { message: 'Número telefónico inválido' }) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) carrier?: string;
  @IsOptional() @IsString() @MaxLength(80) apn?: string;
  @IsOptional() @IsString() @MaxLength(80) apnUser?: string;
}

export class CreateDeviceDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsString() @MaxLength(60) manufacturer: string;
  @IsString() @MaxLength(120) model: string;
  @IsString() @Matches(/^[a-z0-9]+$/) protocol: string;
  @IsInt() @Min(1) @Max(65535) port: number;
  @IsString() @Matches(/^[A-Za-z0-9_-]{4,40}$/, { message: 'Identificador inválido (IMEI o ID de 4 a 40 caracteres alfanuméricos)' }) uniqueId: string;
  @IsOptional() @IsString() @MaxLength(60) serialNumber?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @ValidateNested() @Type(() => SimDto) sim?: SimDto;
  @IsOptional() @IsUUID() companyId?: string;
}

export class UpdateDeviceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(60) serialNumber?: string;
  @IsOptional() @IsUUID() vehicleId?: string | null;
}
