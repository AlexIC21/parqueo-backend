import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    const result = await this.databaseService.query(
      `
      SELECT id, email, role, full_name, nickname, user_category, is_active
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
      [payload.sub],
    );

    const user = result.rows[0];

    if (!user || user.is_active !== true) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    return {
      id: Number(user.id),
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      nickname: user.nickname,
      userCategory: user.user_category,
    };
  }
}
