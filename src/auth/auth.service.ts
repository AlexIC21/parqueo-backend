import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface UserRow {
  id: number;
  email: string;
  role: string;
  user_category?: string | null;
  full_name?: string | null;
  nickname?: string | null;
  is_active?: boolean | null;
  password_value?: string | null;
}

interface BcryptModule {
  compare: (plain: string, hash: string) => Promise<boolean>;
  hash: (plain: string, saltRounds: number) => Promise<string>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const fullName = dto.fullName?.trim();
    const nickname = dto.nickname?.trim();
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password ?? '';
    const confirmPassword = dto.confirmPassword ?? '';

    if (!fullName || !nickname || !email || !password || !confirmPassword) {
      throw new BadRequestException({
        success: false,
        message: 'Los campos obligatorios deben ser completados',
      });
    }

    if (!email.endsWith('@ucb.edu.bo')) {
      throw new BadRequestException({
        success: false,
        message: 'Solo se permiten correos institucionales @ucb.edu.bo',
      });
    }

    if (password.length < 6) {
      throw new BadRequestException({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    if (confirmPassword.length < 6) {
      throw new BadRequestException({
        success: false,
        message: 'La confirmación de contraseña debe tener al menos 6 caracteres',
      });
    }

    if (password !== confirmPassword) {
      throw new BadRequestException({
        success: false,
        message: 'Las contraseñas no coinciden',
      });
    }

    const roleValue = 'USUARIO';
    const userCategoryValue = 'ESTUDIANTE';

    const existing = await this.databaseService.query<{ id: number }>(
      `
        SELECT id
        FROM users
        WHERE lower(email) = $1
        LIMIT 1;
      `,
      [email],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException({
        success: false,
        message: 'El correo ya está registrado',
      });
    }

    const passwordHash = await this.hashPassword(password);

    const insertResult = await this.databaseService.query<UserRow>(
      `
        INSERT INTO users (full_name, nickname, email, password_hash, role, user_category, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, full_name, nickname, email, role, user_category, is_active;
      `,
      [fullName, nickname, email, passwordHash, roleValue, userCategoryValue, true],
    );

    const user = insertResult.rows[0];
    if (!user) {
      throw new InternalServerErrorException({
        success: false,
        message: 'No se pudo registrar el usuario',
      });
    }

    return {
      success: true,
      message: 'Usuario registrado correctamente',
      data: {
        id: Number(user.id),
        fullName: user.full_name ?? '',
        nickname: user.nickname ?? '',
        email: user.email,
        role: user.role,
        userCategory: user.user_category ?? userCategoryValue,
        isActive: user.is_active ?? true,
      },
    };
  }

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
      SELECT id, email, role, user_category, full_name, nickname, is_active, ${passwordColumn} AS password_value
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
      nickname: user.nickname ?? '',
      fullName: user.full_name ?? '',
    };

    const accessToken = this.jwtService.sign(payload, { secret: jwtSecret });

    return {
      message: 'Inicio de sesión exitoso',
      accessToken,
      user: {
        id: Number(user.id),
        fullName: user.full_name ?? '',
        nickname: user.nickname ?? '',
        email: user.email,
        name: user.full_name ?? user.nickname ?? '',
        role: user.role,
        userCategory: user.user_category ?? null,
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

  private async hashPassword(plainPassword: string): Promise<string> {
    const bcrypt = await this.tryLoadBcrypt();
    if (!bcrypt) {
      throw new InternalServerErrorException({
        success: false,
        message: 'No se pudo proteger la contraseña',
      });
    }

    return bcrypt.hash(plainPassword, 10);
  }

  private async tryLoadBcrypt(): Promise<BcryptModule | null> {
    try {
      // Use dynamic import via eval to avoid hard dependency when bcrypt is not installed.
      const mod = await (0, eval)('import("bcrypt")');
      return mod as BcryptModule;
    } catch (error) {
      return null;
    }
  }
}
