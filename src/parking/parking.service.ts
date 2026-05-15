import {
  BadRequestException,
  Injectable,
  Logger,
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
  autosMaintenance: number;
  autosAvailable: number;
  motosCapacity: number;
  motosOccupied: number;
  motosAvailable: number;
  totalCapacity: number;
  totalOccupied: number;
  totalOccupancyPercent: number;
  status: string;
  lastMapUpdateAt: string | null;
}

interface AvailabilitySummary {
  cars: {
    available: number;
    occupied: number;
    maintenance: number;
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
  lastMapUpdateAt: string | null;
  updatedAt: string | null;
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
  autos_maintenance: string | number;
}

interface MapLastUpdateRow {
  last_map_update_at: string | null;
}

interface MapSummaryRow {
  free: string | number;
  occupied: string | number;
  maintenance: string | number;
}

interface MapLastUpdate {
  lastMapUpdateAt: string | null;
  minutesSinceLastUpdate: number | null;
  isStale: boolean;
  staleThresholdMinutes: number;
}

const MOTORCYCLE_CAPACITY = 30;
const MAP_STALE_THRESHOLD_MINUTES = 5;

@Injectable()
export class ParkingService {
  private readonly logger = new Logger(ParkingService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getAvailabilityRaw(): Promise<AvailabilityRaw> {
    const [availabilityResult, spacesAvailabilityResult, lastUpdate] =
      await Promise.all([
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
            COUNT(*) FILTER (WHERE status = 'OCUPADO')::int AS autos_occupied,
            COUNT(*) FILTER (WHERE status = 'MANTENIMIENTO')::int AS autos_maintenance
          FROM parking_spaces
          WHERE vehicle_type = 'AUTO';
        `),
        this.getLastMapUpdate(),
      ]);

    const data = availabilityResult.rows[0];
    const spacesAvailability = spacesAvailabilityResult.rows[0];

    if (!data) {
      throw new NotFoundException('No existe disponibilidad registrada.');
    }

    const autosCapacity = Number(spacesAvailability?.autos_capacity ?? 71);
    const autosOccupied = Number(spacesAvailability?.autos_occupied ?? 0);
    const autosMaintenance = Number(
      spacesAvailability?.autos_maintenance ?? 0,
    );
    const autosAvailable = Math.max(
      autosCapacity - autosOccupied - autosMaintenance,
      0,
    );
    const motosCapacity = MOTORCYCLE_CAPACITY;
    const motosOccupied = Number(data.motos_occupied ?? 0);
    const motosAvailable = Math.max(motosCapacity - motosOccupied, 0);
    const totalCapacity = autosCapacity + motosCapacity;
    const totalOccupied = autosOccupied + motosOccupied;
    const totalUnavailable = autosOccupied + autosMaintenance + motosOccupied;
    const totalOccupancyPercent =
      totalCapacity > 0
        ? Number(((totalUnavailable / totalCapacity) * 100).toFixed(2))
        : 0;

    this.logger.log(
      `[AVAILABILITY] totalAutos=${autosCapacity} occupiedAutos=${autosOccupied} maintenanceAutos=${autosMaintenance} availableAutos=${autosAvailable}`,
    );

    return {
      parkingLotId: Number(data.parking_lot_id),
      parkingLotName: data.parking_lot_name,
      autosCapacity,
      autosOccupied,
      autosMaintenance,
      autosAvailable,
      motosCapacity,
      motosOccupied,
      motosAvailable,
      totalCapacity,
      totalOccupied,
      totalOccupancyPercent,
      status: this.getGeneralStatus(
        totalOccupancyPercent,
        autosAvailable + motosAvailable,
      ),
      lastMapUpdateAt: lastUpdate.lastMapUpdateAt,
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
    const [availability, spacesResult, summaryResult, lastUpdate] =
      await Promise.all([
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
        this.getMapSummary(),
        this.getLastMapUpdate(),
      ]);

    const summary = summaryResult.rows[0] ?? {
      free: 0,
      occupied: 0,
      maintenance: 0,
    };

    const areas = [
      {
        id: 1,
        name: 'Zona Autos',
        vehicleType: 'CAR',
        totalSpaces: availability.autosCapacity,
        availableSpaces: availability.autosAvailable,
        occupiedSpaces: availability.autosOccupied,
        maintenanceSpaces: availability.autosMaintenance,
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
      summary: {
        free: Number(summary.free),
        occupied: Number(summary.occupied),
        maintenance: Number(summary.maintenance),
      },
      lastUpdate,
      updatedAt: lastUpdate.lastMapUpdateAt,
    };
  }

  async getMapStatus() {
    const [result, lastUpdate] = await Promise.all([
      this.databaseService.query(`
        SELECT
          code AS space_code,
          COALESCE(svg_element_id, code) AS svg_element_id,
          vehicle_type,
          status
        FROM parking_spaces
        WHERE vehicle_type = 'AUTO'
        ORDER BY vehicle_type, sort_number;
      `),
      this.getLastMapUpdate(),
    ]);

    return {
      spaces: result.rows.map((row) => ({
        spaceCode: row.space_code,
        svgElementId: row.svg_element_id,
        vehicleType: row.vehicle_type,
        status: row.status,
      })),
      updatedAt: lastUpdate.lastMapUpdateAt,
      lastUpdate,
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

  private async getMapSummary() {
    return this.databaseService.query<MapSummaryRow>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'LIBRE')::int AS free,
        COUNT(*) FILTER (WHERE status = 'OCUPADO')::int AS occupied,
        COUNT(*) FILTER (WHERE status = 'MANTENIMIENTO')::int AS maintenance
      FROM parking_spaces
      WHERE vehicle_type = 'AUTO';
    `);
  }

  private async getLastMapUpdate(): Promise<MapLastUpdate> {
    const result = await this.databaseService.query<MapLastUpdateRow>(`
      SELECT MAX(updated_at)::text AS last_map_update_at
      FROM parking_spaces;
    `);

    return this.buildMapLastUpdate(result.rows[0]?.last_map_update_at ?? null);
  }

  private buildMapLastUpdate(value: Date | string | null): MapLastUpdate {
    const lastMapUpdateAt = this.toIsoString(value);

    if (!lastMapUpdateAt) {
      return {
        lastMapUpdateAt: null,
        minutesSinceLastUpdate: null,
        isStale: true,
        staleThresholdMinutes: MAP_STALE_THRESHOLD_MINUTES,
      };
    }

    const lastUpdateTime = new Date(lastMapUpdateAt).getTime();
    const minutesSinceLastUpdate = Math.max(
      Math.floor((Date.now() - lastUpdateTime) / 60000),
      0,
    );

    return {
      lastMapUpdateAt,
      minutesSinceLastUpdate,
      isStale: minutesSinceLastUpdate >= MAP_STALE_THRESHOLD_MINUTES,
      staleThresholdMinutes: MAP_STALE_THRESHOLD_MINUTES,
    };
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
      lastMapUpdateAt: this.toIsoString(row.updated_at),
      minutesSinceLastUpdate: 0,
      isStale: false,
      staleThresholdMinutes: MAP_STALE_THRESHOLD_MINUTES,
    };
  }

  private toIsoString(value: Date | string | null) {
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

  private buildAvailabilitySummary(raw: AvailabilityRaw): AvailabilitySummary {
    const carsAvailable = Math.max(
      raw.autosCapacity - raw.autosOccupied - raw.autosMaintenance,
      0,
    );
    const motosAvailable = Math.max(raw.motosCapacity - raw.motosOccupied, 0);
    const totalUnavailable =
      raw.autosOccupied + raw.autosMaintenance + raw.motosOccupied;
    const totalAvailable = Math.max(raw.totalCapacity - totalUnavailable, 0);
    const occupancyPercentage =
      raw.totalCapacity > 0
        ? Number(((totalUnavailable / raw.totalCapacity) * 100).toFixed(2))
        : 0;

    return {
      cars: {
        available: carsAvailable,
        occupied: raw.autosOccupied,
        maintenance: raw.autosMaintenance,
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
      generalStatus: this.getGeneralStatus(
        occupancyPercentage,
        totalAvailable,
      ),
      lastMapUpdateAt: raw.lastMapUpdateAt,
      updatedAt: raw.lastMapUpdateAt,
    };
  }

  private getGeneralStatus(occupancyPercentage: number, available = 1) {
    if (available <= 0 || occupancyPercentage >= 100) {
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
