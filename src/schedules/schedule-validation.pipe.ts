import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const scheduleValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: ValidationError[]) => {
    const hasError = (property: string, constraint: string) =>
      errors.some(
        (error) =>
          error.property === property && error.constraints?.[constraint],
      );

    if (
      hasError('dayOfWeek', 'min') ||
      hasError('dayOfWeek', 'max') ||
      hasError('dayOfWeek', 'isInt')
    ) {
      return new BadRequestException({
        success: false,
        message: 'El día de la semana debe estar entre 1 y 7',
      });
    }

    if (hasError('subject', 'isNotEmpty') || hasError('subject', 'isString')) {
      return new BadRequestException({
        success: false,
        message: 'La materia es obligatoria',
      });
    }

    if (hasError('subject', 'maxLength')) {
      return new BadRequestException({
        success: false,
        message: 'La materia no debe superar 120 caracteres',
      });
    }

    if (hasError('classroom', 'maxLength')) {
      return new BadRequestException({
        success: false,
        message: 'El aula no debe superar 80 caracteres',
      });
    }

    if (
      hasError('startTime', 'isNotEmpty') ||
      hasError('endTime', 'isNotEmpty')
    ) {
      return new BadRequestException({
        success: false,
        message: 'La hora de inicio y fin son obligatorias',
      });
    }

    if (hasError('startTime', 'matches') || hasError('endTime', 'matches')) {
      return new BadRequestException({
        success: false,
        message: 'La hora debe tener formato HH:mm o HH:mm:ss',
      });
    }

    return new BadRequestException({
      success: false,
      message: 'Datos inválidos',
    });
  },
});
