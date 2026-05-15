import { Injectable } from '@nestjs/common';
import { ParkingService } from '../parking/parking.service';

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

  constructor(private readonly parkingService: ParkingService) {}

  async getDashboard() {
    const availability = await this.parkingService.getAvailabilityBundle();
    const data = availability.raw;

    return {
      availability: {
        parkingLotId: data.parkingLotId,
        parkingLotName: data.parkingLotName,
        autosCapacity: data.autosCapacity,
        autosOccupied: data.autosOccupied,
        autosMaintenance: data.autosMaintenance,
        autosAvailable: data.autosAvailable,
        motosCapacity: data.motosCapacity,
        motosOccupied: data.motosOccupied,
        motosAvailable: data.motosAvailable,
        totalCapacity: data.totalCapacity,
        totalOccupied: data.totalOccupied,
        totalOccupancyPercent: data.totalOccupancyPercent,
        status: data.status,
      },
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
