import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request?.headers?.authorization;

      if (!authHeader) {
        throw new UnauthorizedException({
          success: false,
          message: 'No autorizado',
        });
      }

      throw new UnauthorizedException({
        success: false,
        message: 'Sesión inválida o expirada',
      });
    }

    return user as TUser;
  }
}
