import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const registerValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: ValidationError[]) => {
    const flatErrors = (items: ValidationError[]): ValidationError[] =>
      items.flatMap((item) => [item, ...(item.children ?? [])]);

    const allErrors = flatErrors(errors);

    if (allErrors.some((error) => error.constraints?.isNotEmpty)) {
      return new BadRequestException({
        success: false,
        message: 'Los campos obligatorios deben ser completados',
      });
    }

    if (
      allErrors.some(
        (error) => error.property === 'email' && error.constraints?.isEmail,
      )
    ) {
      return new BadRequestException({
        success: false,
        message: 'El correo no tiene un formato válido',
      });
    }

    if (
      allErrors.some(
        (error) =>
          error.property === 'password' && error.constraints?.minLength,
      )
    ) {
      return new BadRequestException({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    if (
      allErrors.some(
        (error) =>
          error.property === 'confirmPassword' && error.constraints?.minLength,
      )
    ) {
      return new BadRequestException({
        success: false,
        message: 'La confirmación de contraseña debe tener al menos 6 caracteres',
      });
    }

    return new BadRequestException({
      success: false,
      message: 'Datos inválidos',
    });
  },
});

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @UsePipes(registerValidationPipe)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
