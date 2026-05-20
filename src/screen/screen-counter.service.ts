import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ParkingGateway } from '../parking/parking.gateway';
import { ParkingService } from '../parking/parking.service';
import {
  ScreenCounterMovementType,
  ScreenCounterVehicleType,
} from './dto/create-counter-movement.dto';

export interface ScreenCounterAuthUser {
  id: number;
  email?: string | null;
  role?: string | null;
  fullName?: string | null;
  nickname?: string | null;
  userCategory?: string | null;
}

interface CounterStateRow {
  id: number;
  parking_lot_id: number | null;
  vehicle_type: ScreenCounterVehicleType;
  total_capacity: number;
  occupied_count: number;
  available_count: number;
  updated_at: Date | string | null;
}

interface CounterMovementRow {
  id: number;
  vehicle_type: ScreenCounterVehicleType;
  movement_type: ScreenCounterMovementType;
  available_before: number;
  available_after: number;
  occupied_before: number;
  occupied_after: number;
  created_at: Date | string | null;
}

export interface PublicCounterSnapshot {
  availableSpaces: number;
  occupiedSpaces: number;
  totalCapacity: number;
  updatedAt: string;
}

export interface CounterSnapshot {
  cars: {
    available: number;
    occupied: number;
    totalCapacity: number;
  };
  motorcycles: {
    available: number;
    occupied: number;
    totalCapacity: number;
  };
  updatedAt: string;
}

const DEFAULT_PARKING_LOT_ID = 1;
const SCREEN_USER_NAME = 'pantalla';

@Injectable()
export class ScreenCounterService {
  private readonly logger = new Logger(ScreenCounterService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly parkingService: ParkingService,
    private readonly parkingGateway: ParkingGateway,
  ) {}

  async getCounter(user: ScreenCounterAuthUser): Promise<CounterSnapshot> {
    this.assertCanUseScreenCounter(user);
    await this.ensureCounterReady();

    return this.getCounterSnapshot();
  }

  async getPublicCounter(
    vehicleType: ScreenCounterVehicleType = 'AUTO',
  ): Promise<PublicCounterSnapshot> {
    await this.ensureCounterReady();

    return this.getPublicCounterSnapshot(vehicleType);
  }

  async registerPublicMovement(
    vehicleType: ScreenCounterVehicleType = 'AUTO',
    movementType: ScreenCounterMovementType,
  ) {
    await this.ensureCounterReady();

    this.logger.log(
      `[SCREEN_COUNTER] source=PUBLIC_TEST vehicleType=${vehicleType} movementType=${movementType}`,
    );

    const result = await this.databaseService.transaction(async (client) => {
      const current = await this.getStateForUpdate(client, vehicleType);
      const next = this.calculateNextState(current, movementType);

      this.logger.log(
        `[SCREEN_COUNTER] availableBefore=${current.available_count} availableAfter=${next.availableCount}`,
      );

      await client.query(
        `
        UPDATE parking_counter_state
        SET available_count = $1,
            occupied_count = $2,
            updated_at = NOW()
        WHERE id = $3;
        `,
        [next.availableCount, next.occupiedCount, current.id],
      );

      const movementResult = await client.query<CounterMovementRow>(
        `
        INSERT INTO parking_counter_movements (
          parking_lot_id,
          vehicle_type,
          movement_type,
          available_before,
          available_after,
          occupied_before,
          occupied_after,
          source,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
        RETURNING
          id,
          vehicle_type,
          movement_type,
          available_before,
          available_after,
          occupied_before,
          occupied_after,
          created_at;
        `,
        [
          current.parking_lot_id ?? DEFAULT_PARKING_LOT_ID,
          vehicleType,
          movementType,
          current.available_count,
          next.availableCount,
          current.occupied_count,
          next.occupiedCount,
          'PUBLIC_TEST',
        ],
      );

      const updatedState = await this.getStateForUpdate(client, vehicleType);

      return {
        movement: movementResult.rows[0],
        counter: this.buildPublicCounterSnapshot(updatedState),
      };
    });

    this.parkingGateway.emitContadorUpdated(result.counter);
    this.logger.log('[SCREEN_COUNTER] socket emitted contador.updated');

    return {
      movement: this.mapMovement(result.movement),
      counter: result.counter,
    };
  }

  async registerMovement(
    user: ScreenCounterAuthUser,
    vehicleType: ScreenCounterVehicleType,
    movementType: ScreenCounterMovementType,
  ) {
    this.assertCanUseScreenCounter(user);
    await this.ensureCounterReady();

    this.logger.log(
      `[SCREEN_COUNTER] userId=${user.id} vehicleType=${vehicleType} movementType=${movementType}`,
    );

    const result = await this.databaseService.transaction(async (client) => {
      const current = await this.getStateForUpdate(client, vehicleType);
      const next = this.calculateNextState(current, movementType);

      this.logger.log(
        `[SCREEN_COUNTER] availableBefore=${current.available_count} availableAfter=${next.availableCount}`,
      );

      await client.query(
        `
        UPDATE parking_counter_state
        SET available_count = $1,
            occupied_count = $2,
            updated_at = NOW()
        WHERE id = $3;
        `,
        [next.availableCount, next.occupiedCount, current.id],
      );

      const movementResult = await client.query<CounterMovementRow>(
        `
        INSERT INTO parking_counter_movements (
          parking_lot_id,
          vehicle_type,
          movement_type,
          available_before,
          available_after,
          occupied_before,
          occupied_after,
          source,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          vehicle_type,
          movement_type,
          available_before,
          available_after,
          occupied_before,
          occupied_after,
          created_at;
        `,
        [
          current.parking_lot_id ?? DEFAULT_PARKING_LOT_ID,
          vehicleType,
          movementType,
          current.available_count,
          next.availableCount,
          current.occupied_count,
          next.occupiedCount,
          'SCREEN_AUTH',
          user.id,
        ],
      );

      const states = await this.getStateRows(client);

      return {
        movement: movementResult.rows[0],
        counter: this.buildSnapshot(states),
      };
    });

    this.parkingGateway.emitScreenCounterUpdated(result.counter);
    this.logger.log('[SCREEN_COUNTER] socket emitted screen.counter.updated');

    return {
      movement: this.mapMovement(result.movement),
      counter: result.counter,
    };
  }

  private assertCanUseScreenCounter(user: ScreenCounterAuthUser): void {
    const role = user.role ?? '';

    if (
      role === 'GUARDIA' ||
      role === 'ADMINISTRADOR' ||
      role === 'PANTALLA' ||
      this.isScreenUser(user)
    ) {
      return;
    }

    throw new ForbiddenException({
      success: false,
      message: 'No tiene permisos para acceder al contador de pantalla',
    });
  }

  private isScreenUser(user: ScreenCounterAuthUser): boolean {
    const identifiers = [
      user.nickname,
      user.fullName,
      user.email,
      user.email?.split('@')[0],
      user.userCategory,
    ];

    return identifiers.some(
      (value) => this.normalize(value) === SCREEN_USER_NAME,
    );
  }

  private normalize(value?: string | null): string {
    return (value ?? '').trim().toLowerCase();
  }

  private async ensureCounterReady(): Promise<void> {
    await this.ensureTables();
    await this.ensureInitialState();
  }

  private async ensureTables(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS parking_counter_state (
        id BIGSERIAL PRIMARY KEY,
        parking_lot_id BIGINT DEFAULT 1,
        vehicle_type VARCHAR(20) NOT NULL DEFAULT 'AUTO',
        total_capacity INT NOT NULL DEFAULT 71,
        occupied_count INT NOT NULL DEFAULT 0,
        available_count INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT parking_counter_state_vehicle_type_check
          CHECK (vehicle_type IN ('AUTO', 'MOTO')),
        CONSTRAINT parking_counter_state_counts_check
          CHECK (
            total_capacity >= 0
            AND occupied_count >= 0
            AND available_count >= 0
            AND available_count <= total_capacity
            AND occupied_count <= total_capacity
          )
      );
    `);

    await this.databaseService.query(`
      ALTER TABLE parking_counter_state
        ALTER COLUMN parking_lot_id SET DEFAULT 1,
        ALTER COLUMN vehicle_type SET DEFAULT 'AUTO',
        ALTER COLUMN total_capacity SET DEFAULT 71;
    `);

    await this.databaseService.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS parking_counter_state_lot_vehicle_idx
      ON parking_counter_state (COALESCE(parking_lot_id, 1), vehicle_type);
    `);

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS parking_counter_movements (
        id BIGSERIAL PRIMARY KEY,
        parking_lot_id BIGINT DEFAULT 1,
        vehicle_type VARCHAR(20) NOT NULL DEFAULT 'AUTO',
        movement_type VARCHAR(20) NOT NULL,
        available_before INT NOT NULL,
        available_after INT NOT NULL,
        occupied_before INT NOT NULL,
        occupied_after INT NOT NULL,
        source VARCHAR(40) NULL DEFAULT 'PUBLIC_TEST',
        created_by BIGINT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT parking_counter_movements_vehicle_type_check
          CHECK (vehicle_type IN ('AUTO', 'MOTO')),
        CONSTRAINT parking_counter_movements_movement_type_check
          CHECK (movement_type IN ('ENTRADA', 'SALIDA')),
        CONSTRAINT parking_counter_movements_counts_check
          CHECK (
            available_before >= 0
            AND available_after >= 0
            AND occupied_before >= 0
            AND occupied_after >= 0
          )
      );
    `);

    await this.databaseService.query(`
      ALTER TABLE parking_counter_movements
        ALTER COLUMN parking_lot_id SET DEFAULT 1,
        ALTER COLUMN vehicle_type SET DEFAULT 'AUTO';
    `);

    await this.databaseService.query(`
      ALTER TABLE parking_counter_movements
        ADD COLUMN IF NOT EXISTS source VARCHAR(40) NULL DEFAULT 'PUBLIC_TEST';
    `);
  }

  private async ensureInitialState(): Promise<void> {
    const availability = await this.parkingService.getAvailabilitySummary();

    await this.insertInitialState(
      'AUTO',
      availability.cars.totalCapacity,
      availability.cars.available,
    );
    await this.insertInitialState(
      'MOTO',
      availability.motorcycles.totalCapacity,
      availability.motorcycles.available,
    );
  }

  private async insertInitialState(
    vehicleType: ScreenCounterVehicleType,
    totalCapacity: number,
    available: number,
  ): Promise<void> {
    const normalizedCapacity = Math.max(Number(totalCapacity) || 0, 0);
    const normalizedAvailable = Math.min(
      Math.max(Number(available) || 0, 0),
      normalizedCapacity,
    );
    const occupied = normalizedCapacity - normalizedAvailable;

    await this.databaseService.query(
      `
      INSERT INTO parking_counter_state (
        parking_lot_id,
        vehicle_type,
        total_capacity,
        occupied_count,
        available_count
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ((COALESCE(parking_lot_id, 1)), vehicle_type) DO NOTHING;
      `,
      [
        DEFAULT_PARKING_LOT_ID,
        vehicleType,
        normalizedCapacity,
        occupied,
        normalizedAvailable,
      ],
    );
  }

  private async getStateForUpdate(
    client: PoolClient,
    vehicleType: ScreenCounterVehicleType,
  ): Promise<CounterStateRow> {
    const result = await client.query<CounterStateRow>(
      `
      SELECT
        id,
        parking_lot_id,
        vehicle_type,
        total_capacity,
        occupied_count,
        available_count,
        updated_at
      FROM parking_counter_state
      WHERE COALESCE(parking_lot_id, 1) = $1
        AND vehicle_type = $2
      FOR UPDATE;
      `,
      [DEFAULT_PARKING_LOT_ID, vehicleType],
    );

    const state = result.rows[0];

    if (!state) {
      throw new BadRequestException({
        success: false,
        message: 'No existe estado de contador para el tipo de vehiculo',
      });
    }

    return this.normalizeStateRow(state);
  }

  private calculateNextState(
    current: CounterStateRow,
    movementType: ScreenCounterMovementType,
  ) {
    if (movementType === 'ENTRADA') {
      if (current.available_count <= 0) {
        throw new BadRequestException({
          success: false,
          message: 'No hay espacios disponibles',
        });
      }

      return {
        availableCount: current.available_count - 1,
        occupiedCount: current.occupied_count + 1,
      };
    }

    if (current.occupied_count <= 0) {
      throw new BadRequestException({
        success: false,
        message: 'No hay vehículos registrados como ocupados',
      });
    }

    const availableCount = current.available_count + 1;

    if (availableCount > current.total_capacity) {
      throw new BadRequestException({
        success: false,
        message: 'El contador no puede superar la capacidad total',
      });
    }

    return {
      availableCount,
      occupiedCount: current.occupied_count - 1,
    };
  }

  private async getCounterSnapshot(): Promise<CounterSnapshot> {
    const result = await this.databaseService.query<CounterStateRow>(`
      SELECT
        id,
        parking_lot_id,
        vehicle_type,
        total_capacity,
        occupied_count,
        available_count,
        updated_at
      FROM parking_counter_state
      WHERE COALESCE(parking_lot_id, 1) = ${DEFAULT_PARKING_LOT_ID}
      ORDER BY vehicle_type;
    `);

    return this.buildSnapshot(
      result.rows.map((row) => this.normalizeStateRow(row)),
    );
  }

  private async getPublicCounterSnapshot(
    vehicleType: ScreenCounterVehicleType,
  ): Promise<PublicCounterSnapshot> {
    const result = await this.databaseService.query<CounterStateRow>(
      `
      SELECT
        id,
        parking_lot_id,
        vehicle_type,
        total_capacity,
        occupied_count,
        available_count,
        updated_at
      FROM parking_counter_state
      WHERE COALESCE(parking_lot_id, 1) = $1
        AND vehicle_type = $2
      LIMIT 1;
      `,
      [DEFAULT_PARKING_LOT_ID, vehicleType],
    );

    const state = result.rows[0];

    if (!state) {
      throw new BadRequestException({
        success: false,
        message: 'No existe estado de contador para el tipo de vehiculo',
      });
    }

    return this.buildPublicCounterSnapshot(this.normalizeStateRow(state));
  }

  private async getStateRows(client: PoolClient): Promise<CounterStateRow[]> {
    const result = await client.query<CounterStateRow>(
      `
      SELECT
        id,
        parking_lot_id,
        vehicle_type,
        total_capacity,
        occupied_count,
        available_count,
        updated_at
      FROM parking_counter_state
      WHERE COALESCE(parking_lot_id, 1) = $1
      ORDER BY vehicle_type;
      `,
      [DEFAULT_PARKING_LOT_ID],
    );

    return result.rows.map((row) => this.normalizeStateRow(row));
  }

  private buildSnapshot(rows: CounterStateRow[]): CounterSnapshot {
    const cars = rows.find((row) => row.vehicle_type === 'AUTO');
    const motorcycles = rows.find((row) => row.vehicle_type === 'MOTO');
    const updatedAt = this.getLatestUpdatedAt(rows);

    return {
      cars: this.mapCounterState(cars, 71),
      motorcycles: this.mapCounterState(motorcycles, 30),
      updatedAt,
    };
  }

  private mapCounterState(
    row: CounterStateRow | undefined,
    fallbackCapacity: number,
  ) {
    const totalCapacity = Number(row?.total_capacity ?? fallbackCapacity);
    const available = Number(row?.available_count ?? totalCapacity);
    const occupied = Number(row?.occupied_count ?? 0);

    return {
      available,
      occupied,
      totalCapacity,
    };
  }

  private buildPublicCounterSnapshot(
    row: CounterStateRow,
  ): PublicCounterSnapshot {
    return {
      availableSpaces: Number(row.available_count),
      occupiedSpaces: Number(row.occupied_count),
      totalCapacity: Number(row.total_capacity),
      updatedAt: this.toIsoString(row.updated_at) ?? new Date().toISOString(),
    };
  }

  private mapMovement(row: CounterMovementRow) {
    return {
      id: Number(row.id),
      vehicleType: row.vehicle_type,
      movementType: row.movement_type,
      availableBefore: Number(row.available_before),
      availableAfter: Number(row.available_after),
      occupiedBefore: Number(row.occupied_before),
      occupiedAfter: Number(row.occupied_after),
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private normalizeStateRow(row: CounterStateRow): CounterStateRow {
    return {
      ...row,
      id: Number(row.id),
      parking_lot_id:
        row.parking_lot_id === null ? null : Number(row.parking_lot_id),
      total_capacity: Number(row.total_capacity),
      occupied_count: Number(row.occupied_count),
      available_count: Number(row.available_count),
    };
  }

  private getLatestUpdatedAt(rows: CounterStateRow[]): string {
    const orderedDates = rows
      .map((row) => this.toIsoString(row.updated_at))
      .filter((value): value is string => Boolean(value))
      .sort();
    const latest = orderedDates[orderedDates.length - 1];

    return latest ?? new Date().toISOString();
  }

  private toIsoString(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const normalizedValue = value.trim().replace(' ', 'T');
    const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue);
    const utcValue = hasTimeZone ? normalizedValue : `${normalizedValue}Z`;

    return new Date(utcValue).toISOString();
  }
}
