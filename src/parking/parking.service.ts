import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  PARKING_SPACE_STATUSES,
  ParkingSpaceStatus,
  UpdateParkingSpaceStatusDto,
} from './dto/update-parking-space-status.dto';
import { ParkingSpaceResponse } from './parking.gateway';

interface AvailabilityRaw {
  parkingLotId: number;
  parkingLotName: string;
  autosCapacity: number;
  autosOccupied: number;
  autosAvailable: number;
  motosCapacity: number;
  motosOccupied: number;
  motosAvailable: number;
  totalCapacity: number;
  totalOccupied: number;
  totalOccupancyPercent: number;
  status: string;
}

interface AvailabilitySummary {
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
  total: {
    available: number;
    occupied: number;
    totalCapacity: number;
    occupancyPercentage: number;
  };
  generalStatus: string;
  updatedAt: string;
}

interface ParkingSpaceRow {
  id: number;
  code: string;
  svg_element_id: string | null;
  vehicle_type: string;
  status: ParkingSpaceStatus;
  occupied_at: Date | string | null;
  updated_at: Date | string | null;
}

interface ParkingSpacesAvailabilityRow {
  autos_capacity: string | number;
  autos_occupied: string | number;
}

const MOTORCYCLE_CAPACITY = 30;

@Injectable()
export class ParkingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAvailabilityRaw(): Promise<AvailabilityRaw> {
    const [availabilityResult, spacesAvailabilityResult] = await Promise.all([
      this.databaseService.query(`
        SELECT
          parking_lot_id,
          parking_lot_name,
          autos_capacity,
          autos_occupied,
          autos_available,
          motos_capacity,
          motos_occupied,
          motos_available,
          total_capacity,
          total_occupied,
          total_occupancy_percent,
          status
        FROM vw_general_availability
        LIMIT 1;
      `),
      this.databaseService.query<ParkingSpacesAvailabilityRow>(`
        SELECT
          COUNT(*)::int AS autos_capacity,
          COUNT(*) FILTER (WHERE status = 'OCUPADO')::int AS autos_occupied
        FROM parking_spaces
        WHERE vehicle_type = 'AUTO';
      `),
    ]);

    const data = availabilityResult.rows[0];
    const spacesAvailability = spacesAvailabilityResult.rows[0];

    if (!data) {
      throw new NotFoundException('No existe disponibilidad registrada.');
    }

    const autosCapacity = Number(spacesAvailability?.autos_capacity ?? 71);
    const autosOccupied = Number(spacesAvailability?.autos_occupied ?? 0);
    const motosCapacity = MOTORCYCLE_CAPACITY;
    const motosOccupied = Number(data.motos_occupied ?? 0);
    const totalCapacity = autosCapacity + motosCapacity;
    const totalOccupied = autosOccupied + motosOccupied;
    const totalOccupancyPercent =
      totalCapacity > 0
        ? Number(((totalOccupied / totalCapacity) * 100).toFixed(2))
        : 0;

    return {
      parkingLotId: Number(data.parking_lot_id),
      parkingLotName: data.parking_lot_name,
      autosCapacity,
      autosOccupied,
      autosAvailable: Math.max(autosCapacity - autosOccupied, 0),
      motosCapacity,
      motosOccupied,
      motosAvailable: Math.max(motosCapacity - motosOccupied, 0),
      totalCapacity,
      totalOccupied,
      totalOccupancyPercent,
      status: data.status,
    };
  }

  async getAvailabilitySummary(): Promise<AvailabilitySummary> {
    const raw = await this.getAvailabilityRaw();
    return this.buildAvailabilitySummary(raw);
  }

  async getAvailabilityBundle() {
    const raw = await this.getAvailabilityRaw();
    return {
      raw,
      summary: this.buildAvailabilitySummary(raw),
    };
  }

  async getMapInfo() {
    const [availability, spacesResult] = await Promise.all([
      this.getAvailabilityRaw(),
      this.databaseService.query(`
        SELECT
          id,
          code AS space_code,
          COALESCE(svg_element_id, code) AS svg_element_id,
          vehicle_type,
          status
        FROM parking_spaces
        WHERE vehicle_type = 'AUTO'
        ORDER BY vehicle_type, sort_number;
      `),
    ]);

    const areas = [
      {
        id: 1,
        name: 'Zona Autos',
        vehicleType: 'CAR',
        totalSpaces: availability.autosCapacity,
        availableSpaces: Math.max(
          availability.autosCapacity - availability.autosOccupied,
          0,
        ),
        occupiedSpaces: availability.autosOccupied,
      },
      {
        id: 2,
        name: 'Zona Motos',
        vehicleType: 'MOTORCYCLE',
        totalSpaces: availability.motosCapacity,
        availableSpaces: Math.max(
          availability.motosCapacity - availability.motosOccupied,
          0,
        ),
        occupiedSpaces: availability.motosOccupied,
      },
    ];

    return {
      map: {
        name: 'Mapa Parqueo UCB',
        version: '1.0',
      },
      areas,
      spaces: spacesResult.rows.map((row) => ({
        id: Number(row.id),
        code: row.space_code,
        vehicleType: row.vehicle_type,
        status: row.status,
        svgElementId: row.svg_element_id,
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  async getMapStatus() {
    const result = await this.databaseService.query(`
      SELECT
        code AS space_code,
        COALESCE(svg_element_id, code) AS svg_element_id,
        vehicle_type,
        status
      FROM parking_spaces
      WHERE vehicle_type = 'AUTO'
      ORDER BY vehicle_type, sort_number;
    `);

    return {
      spaces: result.rows.map((row) => ({
        spaceCode: row.space_code,
        svgElementId: row.svg_element_id,
        vehicleType: row.vehicle_type,
        status: row.status,
      })),
    };
  }

  async updateSpaceStatus(
    id: number,
    dto: UpdateParkingSpaceStatusDto,
  ): Promise<ParkingSpaceResponse> {
    if (!PARKING_SPACE_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        success: false,
        message: 'Estado de espacio inválido',
      });
    }

    const result = await this.databaseService.query<ParkingSpaceRow>(
      `
      UPDATE parking_spaces
      SET
        status = $2::space_status,
        occupied_at = CASE
          WHEN $2::space_status = 'OCUPADO'::space_status THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        code,
        COALESCE(svg_element_id, code) AS svg_element_id,
        vehicle_type,
        status,
        occupied_at,
        updated_at;
    `,
      [id, dto.status],
    );

    const space = result.rows[0];

    if (!space) {
      throw new NotFoundException({
        success: false,
        message: 'Espacio no encontrado',
      });
    }

    return this.mapParkingSpace(space);
  }

  private mapParkingSpace(row: ParkingSpaceRow): ParkingSpaceResponse {
    return {
      id: Number(row.id),
      code: row.code,
      svgElementId: row.svg_element_id ?? row.code,
      vehicleType: row.vehicle_type,
      status: row.status,
      occupiedAt: this.toIsoString(row.occupied_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private buildAvailabilitySummary(raw: AvailabilityRaw): AvailabilitySummary {
    const carsAvailable = Math.max(raw.autosCapacity - raw.autosOccupied, 0);
    const motosAvailable = Math.max(raw.motosCapacity - raw.motosOccupied, 0);
    const totalAvailable = Math.max(raw.totalCapacity - raw.totalOccupied, 0);
    const occupancyPercentage =
      raw.totalCapacity > 0
        ? Number(((raw.totalOccupied / raw.totalCapacity) * 100).toFixed(2))
        : 0;

    return {
      cars: {
        available: carsAvailable,
        occupied: raw.autosOccupied,
        totalCapacity: raw.autosCapacity,
      },
      motorcycles: {
        available: motosAvailable,
        occupied: raw.motosOccupied,
        totalCapacity: raw.motosCapacity,
      },
      total: {
        available: totalAvailable,
        occupied: raw.totalOccupied,
        totalCapacity: raw.totalCapacity,
        occupancyPercentage,
      },
      generalStatus: this.getGeneralStatus(occupancyPercentage),
      updatedAt: new Date().toISOString(),
    };
  }

  private getGeneralStatus(occupancyPercentage: number) {
    if (occupancyPercentage >= 100) {
      return 'LLENO';
    }

    if (occupancyPercentage >= 90) {
      return 'CASI_LLENO';
    }

    if (occupancyPercentage >= 70) {
      return 'DEMANDA_MODERADA';
    }

    return 'DISPONIBLE';
  }
}
