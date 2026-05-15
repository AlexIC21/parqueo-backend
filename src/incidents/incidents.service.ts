import { Injectable } from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto';

interface AuthUser {
  id: number;
}

@Injectable()
export class IncidentsService {
  private incidents: Array<Record<string, unknown>> = [];
  private nextId = 1;

  findAll() {
    return this.incidents;
  }

  create(dto: CreateIncidentDto, user: AuthUser) {
    const incident = {
      id: this.nextId,
      title: dto.title,
      description: dto.description,
      severity: dto.severity ?? null,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    this.nextId += 1;
    this.incidents.unshift(incident);
    return incident;
  }
}
