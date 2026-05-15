import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ParkingGateway } from '../parking/parking.gateway';
import { CreateIncidentDto } from './dto/create-incident.dto';

const INCIDENT_STATUS_ACTIVE = 'ACTIVA';
const INCIDENT_STATUS_RESOLVED = 'RESUELTA';
const INCIDENT_STATUS_CANCELLED = 'CANCELADA';
const USER_ALERT_TITLE = 'Alerta';

interface AuthUser {
  id: number;
}

interface IncidentRow {
  id: number;
  parking_lot_id: number;
  type: string;
  title: string;
  description: string;
  status: string;
  created_by: number;
  resolved_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  resolved_at: Date | string | null;
}

interface UserIncidentRow extends IncidentRow {
  read_at: Date | string | null;
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly parkingGateway: ParkingGateway,
  ) {}

  async findAll() {
    const result = await this.databaseService.query<IncidentRow>(
      `
      SELECT
        id,
        parking_lot_id,
        type,
        title,
        description,
        status,
        created_by,
        resolved_by,
        created_at,
        updated_at,
        resolved_at
      FROM incidents
      WHERE status = $1
      ORDER BY created_at DESC, id DESC;
    `,
      [INCIDENT_STATUS_ACTIVE],
    );

    return result.rows.map((row) => this.mapIncident(row));
  }

  async create(dto: CreateIncidentDto, user: AuthUser) {
    const type = dto.type?.trim();
    const title = dto.title?.trim();
    const description = dto.description?.trim();

    if (!type || !title || !description) {
      throw new BadRequestException({
        success: false,
        message: 'Los datos de la incidencia son obligatorios',
      });
    }

    const result = await this.databaseService.query<IncidentRow>(
      `
      INSERT INTO incidents (
        parking_lot_id,
        type,
        title,
        description,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING
        id,
        parking_lot_id,
        type,
        title,
        description,
        status,
        created_by,
        resolved_by,
        created_at,
        updated_at,
        resolved_at;
    `,
      [
        dto.parkingLotId,
        type,
        title,
        description,
        INCIDENT_STATUS_ACTIVE,
        user.id,
      ],
    );

    const incident = result.rows[0];

    this.parkingGateway.emitIncidentCreated({
      id: Number(incident.id),
      type: incident.type,
      title: USER_ALERT_TITLE,
      description: this.getUserIncidentMessage(incident),
      status: incident.status,
      createdAt: this.toIsoString(incident.created_at),
    });

    return this.mapIncident(incident);
  }

  async resolve(id: number, user: AuthUser) {
    return this.closeIncident(id, user, INCIDENT_STATUS_RESOLVED);
  }

  async cancel(id: number, user: AuthUser) {
    return this.closeIncident(id, user, INCIDENT_STATUS_CANCELLED);
  }

  private async closeIncident(
    id: number,
    user: AuthUser,
    status: typeof INCIDENT_STATUS_RESOLVED | typeof INCIDENT_STATUS_CANCELLED,
  ) {
    const existing = await this.findById(id);

    if (existing.status === status) {
      return {
        id: Number(existing.id),
        status: existing.status,
        resolvedAt: this.toIsoString(existing.resolved_at),
      };
    }

    const result = await this.databaseService.query<IncidentRow>(
      `
      UPDATE incidents
      SET
        status = $1,
        resolved_by = $2,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING
        id,
        parking_lot_id,
        type,
        title,
        description,
        status,
        created_by,
        resolved_by,
        created_at,
        updated_at,
        resolved_at;
    `,
      [status, user.id, id],
    );

    const incident = result.rows[0];

    await this.clearIncidentReads(incident.id);

    if (status === INCIDENT_STATUS_RESOLVED) {
      this.parkingGateway.emitIncidentResolved({
        id: Number(incident.id),
        title: USER_ALERT_TITLE,
        description: this.getUserIncidentMessage(incident),
        status: incident.status,
        resolvedAt: this.toIsoString(incident.resolved_at),
      });
    } else {
      this.parkingGateway.emitIncidentCancelled({
        id: Number(incident.id),
        title: USER_ALERT_TITLE,
        description: this.getUserIncidentMessage(incident),
        status: incident.status,
        resolvedAt: this.toIsoString(incident.resolved_at),
      });
    }

    return {
      id: Number(incident.id),
      status: incident.status,
      resolvedAt: this.toIsoString(incident.resolved_at),
    };
  }

  async findForUser(userId: number) {
    const result = await this.databaseService.query<UserIncidentRow>(
      `
      SELECT
        incidents.id,
        incidents.parking_lot_id,
        incidents.type,
        incidents.title,
        incidents.description,
        incidents.status,
        incidents.created_by,
        incidents.resolved_by,
        incidents.created_at,
        incidents.updated_at,
        incidents.resolved_at,
        incident_reads.read_at
      FROM incidents
      LEFT JOIN incident_reads
        ON incident_reads.incident_id = incidents.id
       AND incident_reads.user_id = $1
      ORDER BY incidents.created_at DESC, incidents.id DESC;
    `,
      [userId],
    );

    const data = result.rows.map((row) => this.mapUserIncident(row));
    const unreadCount = data.filter((incident) => incident.readAt === null).length;

    return {
      data,
      meta: {
        unreadCount,
      },
    };
  }

  async markAsRead(userId: number, incidentId: number) {
    await this.findById(incidentId);

    const result = await this.databaseService.query<{ read_at: Date | string }>(
      `
      INSERT INTO incident_reads (incident_id, user_id, read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (incident_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
      RETURNING read_at;
    `,
      [incidentId, userId],
    );

    return {
      id: incidentId,
      readAt: this.toIsoString(result.rows[0].read_at),
    };
  }

  private async clearIncidentReads(incidentId: number) {
    await this.databaseService.query(
      `
      DELETE FROM incident_reads
      WHERE incident_id = $1;
    `,
      [incidentId],
    );
  }

  private async findById(id: number) {
    const result = await this.databaseService.query<IncidentRow>(
      `
      SELECT
        id,
        parking_lot_id,
        type,
        title,
        description,
        status,
        created_by,
        resolved_by,
        created_at,
        updated_at,
        resolved_at
      FROM incidents
      WHERE id = $1
      LIMIT 1;
    `,
      [id],
    );

    const incident = result.rows[0];
    if (!incident) {
      throw new NotFoundException({
        success: false,
        message: 'Incidencia no encontrada',
      });
    }

    return incident;
  }

  private mapIncident(row: IncidentRow) {
    return {
      id: Number(row.id),
      parkingLotId: Number(row.parking_lot_id),
      type: row.type,
      title: row.title,
      description: row.description,
      status: row.status,
      createdAt: this.toIsoString(row.created_at),
      resolvedAt: this.toIsoString(row.resolved_at),
    };
  }

  private mapUserIncident(row: UserIncidentRow) {
    return {
      id: Number(row.id),
      type: row.type,
      title: USER_ALERT_TITLE,
      description: this.getUserIncidentMessage(row),
      status: row.status,
      createdAt: this.toIsoString(row.created_at),
      resolvedAt: this.toIsoString(row.resolved_at),
      readAt: this.toIsoString(row.read_at),
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

  private getUserIncidentMessage(row: Pick<IncidentRow, 'description' | 'status'>) {
    if (row.status === INCIDENT_STATUS_RESOLVED) {
      return `La incidencia fue resuelta: ${row.description}`;
    }

    if (row.status === INCIDENT_STATUS_CANCELLED) {
      return `La incidencia fue cancelada: ${row.description}`;
    }

    return `Se registro una incidencia: ${row.description}`;
  }
}
