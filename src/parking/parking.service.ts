import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ParkingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAvailability() {
    const result = await this.databaseService.query(`
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

    const data = result.rows[0];

    if (!data) {
      throw new NotFoundException('No existe disponibilidad registrada.');
    }

    const totalCapacity = Number(data.total_capacity);
    const totalOccupied = Number(data.total_occupied);
    const totalOccupancyPercent =
      totalCapacity > 0
        ? Number(((totalOccupied / totalCapacity) * 100).toFixed(2))
        : 0;

    return {
      parkingLotId: Number(data.parking_lot_id),
      parkingLotName: data.parking_lot_name,
      autosCapacity: Number(data.autos_capacity),
      autosOccupied: Number(data.autos_occupied),
      autosAvailable: Number(data.autos_available),
      motosCapacity: Number(data.motos_capacity),
      motosOccupied: Number(data.motos_occupied),
      motosAvailable: Number(data.motos_available),
      totalCapacity,
      totalOccupied,
      totalOccupancyPercent,
      status: data.status,
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
}

