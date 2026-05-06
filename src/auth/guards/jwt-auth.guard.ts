import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request?.headers?.authorization;

      if (!authHeader) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Debe iniciar sesión para acceder a esta función.',
          redirectTo: '/login',
        });
      }

      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Sesión inválida o expirada.',
      });
    }

    return user;
  }
}
