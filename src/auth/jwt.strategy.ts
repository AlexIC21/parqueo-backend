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

interface AuthUserRow {
  id: number;
  email: string;
  role_code?: string | null;
  role?: string | null;
  full_name?: string | null;
  nickname?: string | null;
  user_category?: string | null;
  is_active?: boolean | null;
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

    const roleColumn = await this.getRoleColumn();
    const roleExpression = roleColumn
      ? `${roleColumn} AS role_code`
      : 'NULL AS role_code';

    const result = await this.databaseService.query<AuthUserRow>(
      `
      SELECT
        id,
        email,
        ${roleExpression},
        full_name,
        nickname,
        user_category,
        is_active
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
      role: this.normalizeRole(user),
      fullName: user.full_name,
      nickname: user.nickname,
      userCategory: user.user_category,
    };
  }

  private async getRoleColumn(): Promise<'role_code' | 'role' | null> {
    const result = await this.databaseService.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name IN ('role_code', 'role');
    `,
    );

    const columns = result.rows.map((row) => row.column_name);
    if (columns.includes('role_code')) {
      return 'role_code';
    }

    if (columns.includes('role')) {
      return 'role';
    }

    return null;
  }

  private normalizeRole(user: AuthUserRow): string | null {
    const role = user.role_code ?? user.role ?? null;

    return role ? role.trim().toUpperCase() : null;
  }
}
