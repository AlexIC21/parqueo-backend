import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface CounterState {
  carsLeaving: number;
  motorcyclesLeaving: number;
  vehicleQueue: number;
  updatedAt: string;
}

interface CounterUpdateDto {
  value?: number;
  count?: number;
}

@Injectable()
export class GuardService {
  private counters: CounterState = {
    carsLeaving: 0,
    motorcyclesLeaving: 0,
    vehicleQueue: 0,
    updatedAt: new Date().toISOString(),
  };

  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard() {
    const availability = await this.databaseService.query(`
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
    `);

    const data = availability.rows[0] ?? null;

    return {
      availability: data
        ? {
            parkingLotId: Number(data.parking_lot_id),
            parkingLotName: data.parking_lot_name,
            autosCapacity: Number(data.autos_capacity),
            autosOccupied: Number(data.autos_occupied),
            autosAvailable: Number(data.autos_available),
            motosCapacity: Number(data.motos_capacity),
            motosOccupied: Number(data.motos_occupied),
            motosAvailable: Number(data.motos_available),
            totalCapacity: Number(data.total_capacity),
            totalOccupied: Number(data.total_occupied),
            totalOccupancyPercent: Number(data.total_occupancy_percent),
            status: data.status,
          }
        : null,
      counters: this.counters,
    };
  }

  updateCarsLeaving(dto: CounterUpdateDto) {
    return this.updateCounter('carsLeaving', dto);
  }

  updateMotorcyclesLeaving(dto: CounterUpdateDto) {
    return this.updateCounter('motorcyclesLeaving', dto);
  }

  updateVehicleQueue(dto: CounterUpdateDto) {
    return this.updateCounter('vehicleQueue', dto);
  }

  private updateCounter(
    key: 'carsLeaving' | 'motorcyclesLeaving' | 'vehicleQueue',
    dto: CounterUpdateDto,
  ) {
    const nextValue = Number(dto.value ?? dto.count ?? 0);

    this.counters = {
      ...this.counters,
      [key]: Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : 0,
      updatedAt: new Date().toISOString(),
    };

    return this.counters;
  }
}
