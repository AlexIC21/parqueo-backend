import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

interface UserRow {
  id: number;
  email: string;
  role: string;
  full_name?: string | null;
  nickname?: string | null;
  is_active?: boolean | null;
  password_value?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    if (!email.endsWith('@ucb.edu.bo')) {
      throw new BadRequestException(
        'El correo debe pertenecer al dominio @ucb.edu.bo',
      );
    }

    const passwordColumn = await this.getPasswordColumn();
    if (!passwordColumn) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const result = await this.databaseService.query<UserRow>(
      `
      SELECT id, email, role, full_name, nickname, is_active, ${passwordColumn} AS password_value
      FROM users
      WHERE lower(email) = $1
      LIMIT 1;
    `,
      [email],
    );

    const user = result.rows[0];
    if (!user || user.is_active === false) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const passwordValue = user.password_value ?? '';
    const isValidPassword = await this.comparePassword(dto.password, passwordValue);
    if (!isValidPassword) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required.');
    }

    const payload = {
      sub: Number(user.id),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { secret: jwtSecret });

    return {
      message: 'Inicio de sesión exitoso',
      accessToken,
      user: {
        id: Number(user.id),
        email: user.email,
        name: user.full_name ?? user.nickname ?? '',
        role: user.role,
      },
    };
  }

  private async getPasswordColumn(): Promise<'password' | 'password_hash' | null> {
    const result = await this.databaseService.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name IN ('password', 'password_hash');
    `,
    );

    const columns = result.rows.map((row) => row.column_name);
    if (columns.includes('password_hash')) {
      return 'password_hash';
    }

    if (columns.includes('password')) {
      return 'password';
    }

    return null;
  }

  private async comparePassword(
    plainPassword: string,
    storedPassword: string,
  ): Promise<boolean> {
    const bcrypt = await this.tryLoadBcrypt();
    if (bcrypt && this.looksLikeBcryptHash(storedPassword)) {
      return bcrypt.compare(plainPassword, storedPassword);
    }

    return plainPassword === storedPassword;
  }

  private looksLikeBcryptHash(value: string) {
    return /^\$2[aby]\$/.test(value);
  }

  private async tryLoadBcrypt(): Promise<
    { compare: (plain: string, hash: string) => Promise<boolean> } | null
  > {
    try {
      // Use dynamic import via eval to avoid hard dependency when bcrypt is not installed.
      const mod = await (0, eval)('import("bcrypt")');
      return mod as { compare: (plain: string, hash: string) => Promise<boolean> };
    } catch (error) {
      return null;
    }
  }
}
