import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const alertPreferencesValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: ValidationError[]) => {
    const hasError = (property: string, constraint: string) =>
      errors.some(
        (error) =>
          error.property === property && error.constraints?.[constraint],
      );

    if (hasError('userId', 'isEmpty')) {
      return new BadRequestException({
        success: false,
        message: 'No se permite modificar preferencias de otro usuario',
      });
    }

    if (hasError('enabled', 'isBoolean')) {
      return new BadRequestException({
        success: false,
        message: 'El estado de alertas debe ser verdadero o falso',
      });
    }

    if (
      hasError('minutesBefore', 'isInt') ||
      hasError('minutesBefore', 'min') ||
      hasError('minutesBefore', 'max')
    ) {
      return new BadRequestException({
        success: false,
        message: 'Los minutos de anticipacion deben estar entre 1 y 180',
      });
    }

    if (hasError('vehicleType', 'isIn')) {
      return new BadRequestException({
        success: false,
        message: 'El tipo de vehiculo debe ser AUTO o MOTO',
      });
    }

    if (hasError('onlyFirstClassPerDay', 'isBoolean')) {
      return new BadRequestException({
        success: false,
        message:
          'La opcion de primera clase del dia debe ser verdadera o falsa',
      });
    }

    if (
      hasError('selectedScheduleAlerts', 'isArray') ||
      errors.some(
        (error) =>
          error.property === 'selectedScheduleAlerts' &&
          error.children?.some((child) => child.children?.length),
      )
    ) {
      return new BadRequestException({
        success: false,
        message: 'La seleccion de materias para alertas es invalida',
      });
    }

    return new BadRequestException({
      success: false,
      message: 'Datos invalidos',
    });
  },
});
