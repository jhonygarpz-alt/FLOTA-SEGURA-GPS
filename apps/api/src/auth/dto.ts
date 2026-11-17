import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Correo inválido' }) @MaxLength(200) email: string;
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

export class MfaVerifyDto {
  @IsString() mfaToken: string;
  @IsString() @Length(6, 6, { message: 'El código debe tener 6 dígitos' }) code: string;
}

export class MfaCodeDto {
  @IsString() @Length(6, 6, { message: 'El código debe tener 6 dígitos' }) code: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' }) @MaxLength(200) newPassword: string;
}
